package validator

import "strings"

// RunByLanguage запускает валидатор для указанного языка.
// Go проверяется через AST, для Python реализованы простые текстовые проверки под конкретные лабы,
// остальные языки пока возвращают «в разработке».
func RunByLanguage(lang string, rules []Rule, files []File) []RuleResult {
	switch lang {
	case "go", "":
		return Run(rules, files)
	case "python":
		return RunPython(rules, files)
	case "java", "javascript", "js", "cpp", "c++":
		return stubResults(rules, lang)
	default:
		return stubResults(rules, lang)
	}
}

func stubResults(rules []Rule, lang string) []RuleResult {
	results := make([]RuleResult, 0, len(rules))
	msg := "Валидатор для " + lang + " в разработке; код принят для прохождения."
	for _, rule := range rules {
		results = append(results, RuleResult{
			RuleID:   rule.ID,
			Passed:   true,
			Message:  msg,
			Severity: rule.Severity,
		})
	}
	return results
}

func Run(rules []Rule, files []File) []RuleResult {
	ctx := runASTChecks(files)
	results := make([]RuleResult, 0, len(rules))
	for _, rule := range rules {
		passed, msg := evaluateRule(rule.Check, ctx)
		rr := RuleResult{
			RuleID:   rule.ID,
			Passed:   passed,
			Message:  msg,
			Severity: rule.Severity,
		}
		if !passed {
			rr.Hint1 = rule.Hint1
			rr.Hint2 = rule.Hint2
			rr.Hint3 = rule.Hint3
		}
		results = append(results, rr)
	}
	return results
}

func evaluateRule(check string, ctx *checkContext) (passed bool, message string) {
	switch check {
	case "no_raw_os_open":
		if ctx.hasRawOsOpen {
			return false, "Blocker: остаётся os.Open(userInput) без нормализации/валидации пути"
		}
		return true, "OK"
	case "has_filepath_clean":
		if !ctx.hasFilepathClean {
			return false, "Major: должен использоваться filepath.Clean для нормализации пути"
		}
		return true, "OK"
	case "path_inside_basedir":
		if !ctx.pathInsideBasedir {
			return false, "Major: путь после нормализации должен проверяться на нахождение внутри baseDir (prefix/rel)"
		}
		return true, "OK"
	case "http_error_status":
		if !ctx.hasCorrectHTTPError {
			return false, "Minor: для ошибок доступа используйте http.Error с корректным статусом (403/404)"
		}
		return true, "OK"
	default:
		return true, "OK"
	}
}

// RunPython выполняет упрощённые проверки Python‑кода для наших лабораторных.
// Мы анализируем исходник текстово по ключевым конструкциям, без полноценного AST.
func RunPython(rules []Rule, files []File) []RuleResult {
	src := ""
	for _, f := range files {
		if strings.HasSuffix(f.Path, ".py") {
			src += "\n" + f.Content
		}
	}
	results := make([]RuleResult, 0, len(rules))
	for _, rule := range rules {
		var passed bool
		var msg string
		switch rule.Check {
		// Path Traversal — отдельные проверки
		case "py_path_join_norm":
			hasJoin := strings.Contains(src, "os.path.join(")
			hasNorm := strings.Contains(src, "os.path.normpath(")
			passed = hasJoin && hasNorm
			if passed {
				msg = "OK: путь собирается через os.path.join и os.path.normpath"
			} else {
				msg = "Используйте os.path.join(BASE_DIR, filename) и os.path.normpath(joined)."
			}
		case "py_path_commonpath":
			hasCommon := strings.Contains(src, "os.path.commonpath(")
			passed = hasCommon
			if passed {
				msg = "OK: проверка через os.path.commonpath"
			} else {
				msg = "Проверьте, что итоговый путь внутри BASE_DIR: os.path.commonpath([BASE_DIR, safe_path]) == BASE_DIR."
			}
		case "py_path_no_direct":
			directPath := strings.Contains(src, "path = filename") || strings.Contains(src, "send_file(filename)")
			passed = !directPath
			if passed {
				msg = "OK: filename не передаётся напрямую в файловые операции"
			} else {
				msg = "Не передавайте filename напрямую в open/send_file; используйте безопасный путь после проверки."
			}
		case "py_path_http":
			has403 := strings.Contains(src, "abort(403)")
			has404 := strings.Contains(src, "abort(404)")
			passed = has403 && has404
			if passed {
				msg = "OK: при отказе в доступе — 403, при отсутствии файла — 404"
			} else {
				msg = "Возвращайте abort(403) при выходе за BASE_DIR и abort(404) если файл не найден."
			}
		case "py_path_traversal":
			// Обратная совместимость: одна общая проверка
			hasJoin := strings.Contains(src, "os.path.join(")
			hasNorm := strings.Contains(src, "os.path.normpath(")
			hasCommon := strings.Contains(src, "os.path.commonpath(")
			directPath := strings.Contains(src, "path = filename") || strings.Contains(src, "send_file(filename)")
			passed = hasJoin && hasNorm && hasCommon && !directPath
			if passed {
				msg = "OK: путь собирается и проверяется через os.path.join/normpath/commonpath"
			} else {
				msg = "Path Traversal: используйте os.path.join + os.path.normpath + os.path.commonpath и не передавайте filename напрямую."
			}
		// SSRF — отдельные проверки
		case "py_ssrf_parse":
			hasParse := strings.Contains(src, "urlparse(") || strings.Contains(src, "urllib.parse")
			passed = hasParse
			if passed {
				msg = "OK: URL парсится через urllib.parse.urlparse"
			} else {
				msg = "Используйте urllib.parse.urlparse для разбора URL."
			}
		case "py_ssrf_scheme":
			hasScheme := strings.Contains(src, "u.scheme") && (strings.Contains(src, "\"http\"") || strings.Contains(src, "'http'")) && (strings.Contains(src, "\"https\"") || strings.Contains(src, "'https'"))
			passed = hasScheme
			if passed {
				msg = "OK: разрешены только схемы http и https"
			} else {
				msg = "Проверьте u.scheme in (\"http\", \"https\")."
			}
		case "py_ssrf_host":
			hasHostCheck := strings.Contains(src, "host") && (strings.Contains(src, "ALLOWED") || strings.Contains(src, "allowed") || strings.Contains(src, "is_private") || strings.Contains(src, "abort(403)"))
			passed = hasHostCheck
			if passed {
				msg = "OK: hostname проверяется по allowlist или блокируются приватные адреса"
			} else {
				msg = "Проверяйте hostname по списку разрешённых и/или блокируйте приватные/loopback IP."
			}
		case "py_ssrf_timeout":
			hasTimeout := strings.Contains(src, "timeout=")
			passed = hasTimeout
			if passed {
				msg = "OK: requests.get вызывается с timeout"
			} else {
				msg = "Добавьте timeout в requests.get (например timeout=3)."
			}
		case "py_ssrf":
			hasParse := strings.Contains(src, "urlparse(") || strings.Contains(src, "urllib.parse")
			hasSchemeCheck := strings.Contains(src, "u.scheme") && (strings.Contains(src, "http") && strings.Contains(src, "https"))
			hasTimeout := strings.Contains(src, "timeout=")
			passed = hasParse && hasSchemeCheck && hasTimeout
			if passed {
				msg = "OK: URL проходит парсинг, проверку схемы и используется timeout."
			} else {
				msg = "SSRF: добавьте urlparse, проверку схемы/hostname и timeout в requests.get."
			}
		// Logging — отдельные проверки
		case "py_log_abort":
			unsafeAbort := strings.Contains(src, "abort(500, str(")
			passed = !unsafeAbort
			if passed {
				msg = "OK: пользователю не возвращаются внутренние детали ошибки"
			} else {
				msg = "Не используйте abort(500, str(exc)); верните нейтральное сообщение."
			}
		case "py_log_no_token":
			unsafeTokenLog := strings.Contains(src, "token=%s")
			passed = !unsafeTokenLog
			if passed {
				msg = "OK: токен не логируется в открытом виде"
			} else {
				msg = "Не логируйте token целиком; уберите его из формата лога или маскируйте."
			}
		case "py_log_context":
			hasContext := strings.Contains(src, "request_id") || strings.Contains(src, "X-Request-ID") || strings.Contains(src, "request.path")
			passed = hasContext
			if passed {
				msg = "OK: в логе есть контекст запроса (request_id или path)"
			} else {
				msg = "Добавьте в лог request_id или путь запроса для контекста."
			}
		case "py_logging":
			unsafeAbort := strings.Contains(src, "abort(500, str(")
			unsafeTokenLog := strings.Contains(src, "token=%s") || (strings.Contains(src, "log.error") && strings.Contains(src, "token"))
			passed = !unsafeAbort && !unsafeTokenLog
			if passed {
				msg = "OK: сообщение пользователю безопасно, токен не логируется."
			} else {
				msg = "Уберите abort(500, str(exc)) и явное логирование токена."
			}
		// SQL Injection
		case "py_sql_param":
			hasPlaceholder := strings.Contains(src, "?") && (strings.Contains(src, "execute(") && (strings.Contains(src, "name,") || strings.Contains(src, "name)")))
			passed = hasPlaceholder
			if passed {
				msg = "OK: запрос параметризован (плейсхолдер и параметры в execute)"
			} else {
				msg = "Используйте плейсхолдер ? и cursor.execute(query, (name,))."
			}
		case "py_sql_no_fstring":
			noFstringSQL := !strings.Contains(src, "f\"SELECT") && !strings.Contains(src, "f'SELECT")
			passed = noFstringSQL
			if passed {
				msg = "OK: SQL не собирается через f-строку с пользовательским вводом"
			} else {
				msg = "Не используйте f-строку для подстановки name в текст SQL."
			}
		// XSS
		case "py_xss_no_fstring":
			noFstringHTML := !strings.Contains(src, "f\"<") && !strings.Contains(src, "f'<") && !strings.Contains(src, "f\"<h1>") && !strings.Contains(src, "f\"<div>")
			passed = noFstringHTML
			if passed {
				msg = "OK: HTML не собирается через f-строку с пользовательским вводом"
			} else {
				msg = "Не собирайте HTML через f\"<...{name}...\"; используйте шаблон с экранированием."
			}
		case "py_xss_template":
			hasTemplate := (strings.Contains(src, "render_template") || strings.Contains(src, "render_template_string")) && strings.Contains(src, "name=")
			passed = hasTemplate
			if passed {
				msg = "OK: вывод через шаблон с экранированием"
			} else {
				msg = "Используйте render_template или render_template_string и передавайте name в шаблон ({{ name }})."
			}
		default:
			passed, msg = true, "OK"
		}
		rr := RuleResult{
			RuleID:   rule.ID,
			Passed:   passed,
			Message:  msg,
			Severity: rule.Severity,
		}
		if !passed {
			rr.Hint1 = rule.Hint1
			rr.Hint2 = rule.Hint2
			rr.Hint3 = rule.Hint3
		}
		results = append(results, rr)
	}
	return results
}
