package validator

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"regexp"
	"strings"
)

type checkContext struct {
	hasRawOsOpen        bool
	hasFilepathClean    bool
	pathInsideBasedir   bool
	hasCorrectHTTPError bool
}

func runASTChecks(files []File) *checkContext {
	ctx := &checkContext{}
	for _, f := range files {
		if filepath.Ext(f.Path) != ".go" {
			continue
		}
		runOneFile(f.Content, ctx)
	}
	return ctx
}

func runOneFile(src string, ctx *checkContext) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, "", src, parser.ParseComments)
	if err != nil {
		return
	}
	ast.Inspect(node, func(n ast.Node) bool {
		if n == nil {
			return true
		}
		checkCallExpr(n, ctx, src)
		return true
	})
	// Regex fallback for path containment (strings.Contains etc.)
	ctx.pathInsideBasedir = ctx.pathInsideBasedir || regexPathInsideBase(src)
	ctx.hasCorrectHTTPError = ctx.hasCorrectHTTPError || regexHTTPError(src)
}

func checkCallExpr(n ast.Node, ctx *checkContext, src string) {
	call, ok := n.(*ast.CallExpr)
	if !ok {
		return
	}
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return
	}
	fn := ""
	if id, ok := sel.X.(*ast.Ident); ok {
		fn = id.Name + "." + sel.Sel.Name
	}
	switch fn {
	case "os.Open":
		arg := firstArg(call)
		if arg == "" {
			return
		}
		if isUserInput(arg, src) {
			ctx.hasRawOsOpen = true
		}
	case "filepath.Clean":
		ctx.hasFilepathClean = true
	}
	// path inside base: filepath.HasPrefix or strings.HasPrefix(clean, baseDir) or filepath.Rel
	if fn == "filepath.Rel" || fn == "strings.HasPrefix" {
		ctx.pathInsideBasedir = true
	}
	if fn == "http.Error" {
		ctx.hasCorrectHTTPError = true
	}
}

func firstArg(call *ast.CallExpr) string {
	if len(call.Args) == 0 {
		return ""
	}
	switch a := call.Args[0].(type) {
	case *ast.Ident:
		return a.Name
	case *ast.SelectorExpr:
		if x, ok := a.X.(*ast.Ident); ok {
			return x.Name + "." + a.Sel.Name
		}
	}
	return ""
}

func isUserInput(s string, src string) bool {
	// Typical: r.URL.Query().Get("file"), r.FormValue("file"), filename from request
	lower := strings.ToLower(s)
	if strings.Contains(lower, "query") || strings.Contains(lower, "form") ||
		strings.Contains(lower, "url") || strings.Contains(lower, "param") ||
		s == "filename" || s == "path" || s == "file" {
		return true
	}
	return regexp.MustCompile(`(r\.URL|Request|userInput|input)`).MatchString(s)
}

func regexPathInsideBase(src string) bool {
	// filepath.Rel(baseDir, clean) and check for ".." or error
	if strings.Contains(src, "filepath.Rel") && (strings.Contains(src, "..") || strings.Contains(src, "err != nil")) {
		return true
	}
	if strings.Contains(src, "strings.HasPrefix") && strings.Contains(src, "baseDir") {
		return true
	}
	if strings.Contains(src, "filepath.HasPrefix") {
		return true
	}
	return false
}

func regexHTTPError(src string) bool {
	return strings.Contains(src, "http.Error") && (strings.Contains(src, "403") || strings.Contains(src, "404") || strings.Contains(src, "StatusForbidden") || strings.Contains(src, "StatusNotFound"))
}
