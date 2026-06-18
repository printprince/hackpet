package validator

import (
	"regexp"
	"strings"
)

// pyCheckContext — результаты структурного анализа Python-кода.
type pyCheckContext struct {
	src string // original source for regex fallbacks in evaluatePythonRule

	// Path traversal
	hasOsPathJoin       bool
	hasOsPathNormpath   bool
	hasOsPathCommonpath bool
	hasDirectOpen       bool // open(filename) без safe_path

	// SSRF
	hasURLParse    bool
	hasSchemeCheck bool
	hasHostCheck   bool
	hasTimeout     bool

	// Logging / errors
	hasUnsafeAbort    bool // abort(500, str(exc))
	hasTokenInLog     bool // токен попадает в лог
	hasRequestContext bool // request_id / path в логе

	// SQL
	hasSQLParam   bool // execute с плейсхолдером
	hasSQLFString bool // f"SELECT...{var}"

	// XSS
	hasHTMLFString bool // f"<tag...{var}"
	hasTemplate    bool // render_template с переменной
}

// runPythonASTChecks анализирует все .py-файлы и возвращает контекст проверок.
func runPythonASTChecks(files []File) *pyCheckContext {
	ctx := &pyCheckContext{}
	for _, f := range files {
		if strings.HasSuffix(f.Path, ".py") {
			analyzePythonFile(f.Content, ctx)
		}
	}
	return ctx
}

func analyzePythonFile(src string, ctx *pyCheckContext) {
	ctx.src += src + "\n"
	clean := stripPythonNonCode(src)

	// --- Path traversal ---
	ctx.hasOsPathJoin = ctx.hasOsPathJoin || hasPyCall(clean, "os.path.join")
	ctx.hasOsPathNormpath = ctx.hasOsPathNormpath || hasPyCall(clean, "os.path.normpath")
	ctx.hasOsPathCommonpath = ctx.hasOsPathCommonpath || hasPyCall(clean, "os.path.commonpath")
	ctx.hasDirectOpen = ctx.hasDirectOpen || checkDirectOpen(clean)

	// --- SSRF ---
	ctx.hasURLParse = ctx.hasURLParse || checkURLParse(clean)
	ctx.hasSchemeCheck = ctx.hasSchemeCheck || checkSchemeValidation(src, clean)
	ctx.hasHostCheck = ctx.hasHostCheck || checkHostValidation(clean)
	ctx.hasTimeout = ctx.hasTimeout || checkTimeout(clean)

	// --- Logging / errors ---
	ctx.hasUnsafeAbort = ctx.hasUnsafeAbort || checkUnsafeAbort(clean)
	ctx.hasTokenInLog = ctx.hasTokenInLog || checkTokenInLog(src, clean)
	ctx.hasRequestContext = ctx.hasRequestContext || checkRequestContext(src, clean)

	// --- SQL ---
	ctx.hasSQLParam = ctx.hasSQLParam || checkSQLParam(clean)
	ctx.hasSQLFString = ctx.hasSQLFString || checkSQLFString(src)

	// --- XSS ---
	ctx.hasHTMLFString = ctx.hasHTMLFString || checkHTMLFString(src)
	ctx.hasTemplate = ctx.hasTemplate || checkRenderTemplate(clean)
}

// ---------- Stripping ----------

// stripPythonNonCode убирает комментарии и содержимое строковых литералов.
// Структура кода (имена функций, операторы) сохраняется.
func stripPythonNonCode(src string) string {
	var b strings.Builder
	b.Grow(len(src))
	i := 0
	n := len(src)
	for i < n {
		// Triple-quoted strings
		if i+2 < n {
			q3 := src[i : i+3]
			if q3 == `"""` || q3 == `'''` {
				b.WriteString(q3)
				i += 3
				for i < n {
					if i+2 < n && src[i:i+3] == q3 {
						b.WriteString(q3)
						i += 3
						break
					}
					// preserve newlines for line tracking, mask content
					if src[i] == '\n' {
						b.WriteByte('\n')
					}
					i++
				}
				continue
			}
		}
		c := src[i]
		// Single-line string
		if c == '"' || c == '\'' {
			quote := c
			b.WriteByte(quote)
			i++
			for i < n {
				ch := src[i]
				if ch == '\\' {
					i += 2
					continue
				}
				if ch == quote {
					b.WriteByte(quote)
					i++
					break
				}
				if ch == '\n' {
					break
				}
				i++
			}
			continue
		}
		// Comment
		if c == '#' {
			b.WriteByte(' ')
			i++
			for i < n && src[i] != '\n' {
				i++
			}
			continue
		}
		b.WriteByte(c)
		i++
	}
	return b.String()
}

// ---------- Call detection helpers ----------

// hasPyCall checks whether the cleaned source contains a call to the given
// dotted name (e.g. "os.path.join"), ensuring it is followed by '('.
func hasPyCall(clean, name string) bool {
	idx := 0
	for {
		pos := strings.Index(clean[idx:], name)
		if pos < 0 {
			return false
		}
		abs := idx + pos
		after := abs + len(name)
		if after < len(clean) {
			rest := strings.TrimLeft(clean[after:], " \t")
			if strings.HasPrefix(rest, "(") {
				return true
			}
		}
		idx = abs + 1
	}
}

// callArgs извлекает текст первого аргумента вызова funcName в cleaned src.
func callArgs(clean, funcName string) string {
	idx := strings.Index(clean, funcName)
	if idx < 0 {
		return ""
	}
	start := idx + len(funcName)
	for start < len(clean) && (clean[start] == ' ' || clean[start] == '\t') {
		start++
	}
	if start >= len(clean) || clean[start] != '(' {
		return ""
	}
	start++ // skip '('
	depth := 1
	end := start
	for end < len(clean) && depth > 0 {
		switch clean[end] {
		case '(':
			depth++
		case ')':
			depth--
		}
		if depth > 0 {
			end++
		}
	}
	return clean[start:end]
}

// ---------- Path traversal ----------

// checkDirectOpen returns true when open() or send_file() is called with a raw
// user-supplied variable (filename / path / f) rather than a safe normalised path.
func checkDirectOpen(clean string) bool {
	// Also treat `path` as raw if it is directly assigned from a raw variable
	// e.g. path = filename  or  path = request.args.get(...)
	pathIsRaw := regexp.MustCompile(`\bpath\s*=\s*(filename|user_path|raw_path|request\b)`).MatchString(clean)
	rawPattern := `\b(filename|user_path|raw_path|f)\b`
	if pathIsRaw {
		rawPattern = `\b(filename|user_path|raw_path|f|path)\b`
	}
	rawVars := regexp.MustCompile(rawPattern)
	safeVars := regexp.MustCompile(`\b(safe_path|clean_path|norm_path|trusted)\b`)

	for _, fn := range []string{"open", "send_file"} {
		args := callArgs(clean, fn)
		if args == "" {
			continue
		}
		firstArg := args
		if c := strings.IndexByte(args, ','); c >= 0 {
			firstArg = args[:c]
		}
		if rawVars.MatchString(firstArg) && !safeVars.MatchString(firstArg) {
			return true
		}
	}
	return false
}

// ---------- SSRF ----------

func checkURLParse(clean string) bool {
	return hasPyCall(clean, "urlparse") ||
		strings.Contains(clean, "urllib.parse") ||
		hasPyCall(clean, "urllib.parse.urlparse")
}

func checkSchemeValidation(orig, clean string) bool {
	// u.scheme == "http" / u.scheme in ("http", "https")
	hasSchemeAttr := strings.Contains(clean, ".scheme")
	hasHTTP := strings.Contains(orig, `"http"`) || strings.Contains(orig, `'http'`)
	hasHTTPS := strings.Contains(orig, `"https"`) || strings.Contains(orig, `'https'`)
	return hasSchemeAttr && hasHTTP && hasHTTPS
}

func checkHostValidation(clean string) bool {
	hostnameUsed := strings.Contains(clean, ".hostname") ||
		strings.Contains(clean, ".netloc") ||
		strings.Contains(clean, "host")
	allowlistUsed := strings.Contains(clean, "ALLOWED") ||
		strings.Contains(clean, "allowed") ||
		regexp.MustCompile(`\ballow`).MatchString(clean) ||
		strings.Contains(clean, "is_private") ||
		strings.Contains(clean, "abort(403)")
	return hostnameUsed && allowlistUsed
}

func checkTimeout(clean string) bool {
	// timeout= as keyword argument
	return regexp.MustCompile(`\btimeout\s*=`).MatchString(clean)
}

// ---------- Logging / errors ----------

func checkUnsafeAbort(clean string) bool {
	// abort(500, str( — returning internal error to user
	return regexp.MustCompile(`abort\s*\(\s*500\s*,\s*str\s*\(`).MatchString(clean)
}

// checkTokenInLog returns true when a token/password variable or format hint
// appears as an argument to a logging call.
func checkTokenInLog(orig, clean string) bool {
	logCallRe := regexp.MustCompile(`(?m)(logging\.(debug|info|warning|error|critical)|logger\.(debug|info|warning|error|critical)|print)\s*\(([^)]+)\)`)
	matches := logCallRe.FindAllStringSubmatch(clean, -1)
	secretRe := regexp.MustCompile(`\b(token|password|passwd|secret|api_key|apikey|bearer)\b`)
	for _, m := range matches {
		args := m[len(m)-1]
		if secretRe.MatchString(strings.ToLower(args)) {
			return true
		}
	}
	// Also catch format strings in original source with secret hints
	fmtRe := regexp.MustCompile(`(?i)(token|password)=%s`)
	return fmtRe.MatchString(orig)
}

func checkRequestContext(orig, clean string) bool {
	hints := []string{"request_id", "X-Request-ID", "x-request-id", "request.path", "request.url"}
	for _, h := range hints {
		if strings.Contains(orig, h) {
			return true
		}
	}
	// In cleaned source: variable named request_id passed to log
	return strings.Contains(clean, "request_id")
}

// ---------- SQL ----------

func checkSQLParam(clean string) bool {
	// cursor.execute(query, (param,)) or cursor.execute(sql, [param])
	args := callArgs(clean, "execute")
	if args == "" {
		return false
	}
	// Must have a placeholder and a second argument (tuple or list)
	hasPlaceholder := strings.Contains(args, "?") || strings.Contains(args, "%s")
	hasParamArg := strings.Contains(args, "(") || strings.Contains(args, "[")
	return hasPlaceholder && hasParamArg
}

func checkSQLFString(orig string) bool {
	// f"SELECT...{var}" or f'SELECT...{var}'
	fstrRe := regexp.MustCompile(`(?i)f["'].*SELECT.*\{`)
	return fstrRe.MatchString(orig)
}

// ---------- XSS ----------

func checkHTMLFString(orig string) bool {
	// f"<tag...{var}" — interpolation in HTML
	fstrHTMLRe := regexp.MustCompile(`f["']<[^"']*\{`)
	return fstrHTMLRe.MatchString(orig)
}

func checkRenderTemplate(clean string) bool {
	if !hasPyCall(clean, "render_template") && !hasPyCall(clean, "render_template_string") {
		return false
	}
	// Must pass at least one keyword argument (template variable)
	args := callArgs(clean, "render_template")
	if args == "" {
		args = callArgs(clean, "render_template_string")
	}
	return strings.Contains(args, "=")
}

// ---------- Rule evaluation ----------

func evaluatePythonRule(check string, ctx *pyCheckContext) (bool, string) {
	switch check {
	// Path traversal
	case "py_path_join_norm":
		if !ctx.hasOsPathJoin || !ctx.hasOsPathNormpath {
			return false, "Используйте os.path.join(BASE_DIR, filename) и os.path.normpath(joined) для безопасной сборки пути"
		}
		return true, "OK: путь собирается через os.path.join и os.path.normpath"
	case "py_path_commonpath":
		if !ctx.hasOsPathCommonpath {
			return false, "Проверьте путь через os.path.commonpath([BASE_DIR, safe_path]) == BASE_DIR"
		}
		return true, "OK: проверка через os.path.commonpath"
	case "py_path_no_direct":
		if ctx.hasDirectOpen {
			return false, "Не передавайте filename напрямую в open/send_file; используйте безопасный путь после проверки"
		}
		return true, "OK: filename не передаётся напрямую в файловые операции"
	case "py_path_http":
		hasAbort403 := regexp.MustCompile(`abort\s*\(\s*403`).MatchString(ctx.src)
		hasAbort404 := regexp.MustCompile(`abort\s*\(\s*404`).MatchString(ctx.src)
		if !hasAbort403 && !hasAbort404 {
			return false, "При невалидном пути верните abort(403) или abort(404), а не пустой ответ"
		}
		return true, "OK: возвращается корректный HTTP-статус при ошибке пути"
	case "py_path_traversal":
		ok := ctx.hasOsPathJoin && ctx.hasOsPathNormpath && ctx.hasOsPathCommonpath && !ctx.hasDirectOpen
		if !ok {
			return false, "Path Traversal: используйте os.path.join + os.path.normpath + os.path.commonpath и не передавайте filename напрямую"
		}
		return true, "OK"
	// SSRF
	case "py_ssrf_parse":
		if !ctx.hasURLParse {
			return false, "Используйте urllib.parse.urlparse для разбора URL перед запросом"
		}
		return true, "OK: URL парсится через urllib.parse.urlparse"
	case "py_ssrf_scheme":
		if !ctx.hasSchemeCheck {
			return false, "Проверяйте parsed.scheme in (\"http\", \"https\") перед выполнением запроса"
		}
		return true, "OK: разрешены только схемы http и https"
	case "py_ssrf_host":
		if !ctx.hasHostCheck {
			return false, "Проверяйте hostname по allowlist или блокируйте приватные/loopback-адреса"
		}
		return true, "OK: hostname проверяется по allowlist или блокируются приватные адреса"
	case "py_ssrf_timeout":
		if !ctx.hasTimeout {
			return false, "Добавьте timeout= в requests.get/post (например timeout=3)"
		}
		return true, "OK: requests.get вызывается с timeout"
	case "py_ssrf":
		ok := ctx.hasURLParse && ctx.hasSchemeCheck && ctx.hasTimeout
		if !ok {
			return false, "SSRF: добавьте urlparse, проверку схемы/hostname и timeout в requests.get"
		}
		return true, "OK: URL проходит парсинг, проверку схемы и используется timeout"
	// Logging / errors
	case "py_log_abort":
		if ctx.hasUnsafeAbort {
			return false, "Не используйте abort(500, str(exc)); возвращайте нейтральное сообщение пользователю"
		}
		return true, "OK: пользователю не возвращаются внутренние детали ошибки"
	case "py_log_no_token":
		if ctx.hasTokenInLog {
			return false, "Не логируйте token/secret в открытом виде; уберите из формата или маскируйте"
		}
		return true, "OK: токен не логируется в открытом виде"
	case "py_log_context":
		if !ctx.hasRequestContext {
			return false, "Добавьте в лог request_id или путь запроса для контекста"
		}
		return true, "OK: в логе есть контекст запроса (request_id или path)"
	case "py_logging":
		ok := !ctx.hasUnsafeAbort && !ctx.hasTokenInLog
		if !ok {
			return false, "Уберите abort(500, str(exc)) и явное логирование токена"
		}
		return true, "OK: сообщение пользователю безопасно, токен не логируется"
	// SQL Injection
	case "py_sql_param":
		if !ctx.hasSQLParam {
			return false, "Используйте плейсхолдер ? и cursor.execute(query, (name,)) вместо конкатенации"
		}
		return true, "OK: запрос параметризован (плейсхолдер и параметры в execute)"
	case "py_sql_no_fstring":
		if ctx.hasSQLFString {
			return false, "Не используйте f-строку для подстановки переменных в текст SQL"
		}
		return true, "OK: SQL не собирается через f-строку с пользовательским вводом"
	// XSS
	case "py_xss_no_fstring":
		if ctx.hasHTMLFString {
			return false, "Не собирайте HTML через f\"<...{name}...\"; используйте шаблон с автоматическим экранированием"
		}
		return true, "OK: HTML не собирается через f-строку с пользовательским вводом"
	case "py_xss_template":
		if !ctx.hasTemplate {
			return false, "Используйте render_template и передавайте переменную в шаблон ({{ name }})"
		}
		return true, "OK: вывод через шаблон с экранированием"
	default:
		return false, "Проверка \"" + check + "\" не реализована для Python"
	}
}
