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
	// Path traversal
	hasRawOsOpen        bool
	hasFilepathClean    bool
	pathInsideBasedir   bool
	hasCorrectHTTPError bool

	// SSRF
	hasSchemeCheck   bool // сравнение u.Scheme с http/https
	hasHostnameCheck bool // вызов u.Hostname()
	hasAllowlist     bool // вызов функции-allowlist (имя содержит "allow")
	hasClientTimeout bool // http.Client{Timeout: ...}

	// Logging / safe errors
	hasUnsafeUserError bool // в http.Error наружу уходит err.Error()/токен
	hasSecretInLog     bool // секрет (token/пароль) попадает в лог
	hasRequestIDInLog  bool // в логе есть request id / контекст запроса
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
		checkBinaryExpr(n, ctx)
		checkCompositeLit(n, ctx)
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
	// Вызовы обычных функций: isAllowedHost(...), doWork() и т.п.
	if id, ok := call.Fun.(*ast.Ident); ok {
		if strings.Contains(strings.ToLower(id.Name), "allow") {
			ctx.hasAllowlist = true
		}
		return
	}
	sel, ok := call.Fun.(*ast.SelectorExpr)
	if !ok {
		return
	}
	method := sel.Sel.Name
	receiver := ""
	if id, ok := sel.X.(*ast.Ident); ok {
		receiver = id.Name
	}
	fn := receiver + "." + method

	switch fn {
	case "os.Open":
		if arg := firstArg(call); arg != "" && isUserInput(arg, src) {
			ctx.hasRawOsOpen = true
		}
	case "filepath.Clean":
		ctx.hasFilepathClean = true
	case "filepath.Rel", "strings.HasPrefix":
		ctx.pathInsideBasedir = true
	case "http.Error":
		ctx.hasCorrectHTTPError = true
		if len(call.Args) >= 2 {
			analyzeUserErrorArg(call.Args[1], ctx)
		}
		return
	}

	// SSRF: вызов u.Hostname()
	if method == "Hostname" {
		ctx.hasHostnameCheck = true
	}

	// Logging: вызовы логгера (log.Printf, logger.Errorf и т.п.)
	if isLogCall(receiver, method) {
		analyzeLogCall(call, ctx)
	}
}

// checkBinaryExpr выявляет сравнение u.Scheme с http/https.
func checkBinaryExpr(n ast.Node, ctx *checkContext) {
	be, ok := n.(*ast.BinaryExpr)
	if !ok {
		return
	}
	if isSelector(be.X, "Scheme") || isSelector(be.Y, "Scheme") {
		ctx.hasSchemeCheck = true
	}
}

// checkCompositeLit выявляет http.Client{Timeout: ...}.
func checkCompositeLit(n ast.Node, ctx *checkContext) {
	cl, ok := n.(*ast.CompositeLit)
	if !ok || !isSelector(cl.Type, "Client") {
		return
	}
	for _, el := range cl.Elts {
		if kv, ok := el.(*ast.KeyValueExpr); ok {
			if key, ok := kv.Key.(*ast.Ident); ok && key.Name == "Timeout" {
				ctx.hasClientTimeout = true
			}
		}
	}
}

// analyzeUserErrorArg помечает небезопасное сообщение наружу:
// присутствие err.Error() или секрета (token/пароль) в тексте ответа.
func analyzeUserErrorArg(arg ast.Expr, ctx *checkContext) {
	strs, idents, callSels := collectExprFeatures(arg)
	for _, s := range callSels {
		if s == "Error" {
			ctx.hasUnsafeUserError = true
		}
	}
	for _, id := range idents {
		if isSecretName(id) {
			ctx.hasUnsafeUserError = true
		}
	}
	for _, s := range strs {
		if containsSecretHint(s) {
			ctx.hasUnsafeUserError = true
		}
	}
}

// analyzeLogCall проверяет аргументы лог-вызова на секреты и контекст запроса.
func analyzeLogCall(call *ast.CallExpr, ctx *checkContext) {
	for _, a := range call.Args {
		strs, idents, _ := collectExprFeatures(a)
		for _, id := range idents {
			if isSecretName(id) {
				ctx.hasSecretInLog = true
			}
		}
		for _, s := range strs {
			if containsSecretHint(s) {
				ctx.hasSecretInLog = true
			}
			if containsRequestHint(s) {
				ctx.hasRequestIDInLog = true
			}
		}
	}
}

// collectExprFeatures рекурсивно собирает строковые литералы, имена идентификаторов
// и имена методов из поддерева выражения.
func collectExprFeatures(root ast.Node) (strs, idents, callSels []string) {
	ast.Inspect(root, func(n ast.Node) bool {
		switch x := n.(type) {
		case *ast.BasicLit:
			if x.Kind == token.STRING {
				strs = append(strs, strings.ToLower(strings.Trim(x.Value, "`\"")))
			}
		case *ast.Ident:
			idents = append(idents, strings.ToLower(x.Name))
		case *ast.SelectorExpr:
			callSels = append(callSels, x.Sel.Name)
		}
		return true
	})
	return
}

func isLogCall(receiver, method string) bool {
	loggers := map[string]bool{"log": true, "logger": true, "slog": true, "l": true, "lg": true}
	if !loggers[strings.ToLower(receiver)] {
		return false
	}
	switch method {
	case "Printf", "Println", "Print", "Fatalf", "Fatal", "Fatalln",
		"Panicf", "Panic", "Error", "Errorf", "Info", "Infof",
		"Warn", "Warnf", "Debug", "Debugf":
		return true
	}
	return false
}

func isSecretName(id string) bool {
	switch id {
	case "token", "password", "passwd", "secret", "apikey", "authorization", "bearer":
		return true
	}
	return false
}

func containsSecretHint(s string) bool {
	for _, hint := range []string{"token=", "authorization", "password", "secret", "apikey", "api_key", "bearer "} {
		if strings.Contains(s, hint) {
			return true
		}
	}
	return false
}

func containsRequestHint(s string) bool {
	for _, hint := range []string{"req", "request", "x-request-id", "request_id", "trace"} {
		if strings.Contains(s, hint) {
			return true
		}
	}
	return false
}

func isSelector(e ast.Expr, name string) bool {
	if sel, ok := e.(*ast.SelectorExpr); ok {
		return sel.Sel.Name == name
	}
	return false
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
