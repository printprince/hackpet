package validator


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
	// SSRF
	case "ssrf_url_scheme":
		if !ctx.hasSchemeCheck {
			return false, "Major: после url.Parse проверяйте u.Scheme (разрешены только http/https)"
		}
		return true, "OK"
	case "ssrf_host_allowlist":
		if !(ctx.hasHostnameCheck && ctx.hasAllowlist) {
			return false, "Major: проверяйте u.Hostname() по allowlist (например через isAllowedHost)"
		}
		return true, "OK"
	case "ssrf_client_timeout":
		if !ctx.hasClientTimeout {
			return false, "Minor: используйте http.Client с явным Timeout вместо http.Get без таймаута"
		}
		return true, "OK"
	// Logging / safe errors
	case "log_safe_user_error":
		if ctx.hasUnsafeUserError {
			return false, "Major: не возвращайте err.Error()/токен наружу — отдавайте нейтральное сообщение"
		}
		return true, "OK"
	case "log_no_secrets":
		if ctx.hasSecretInLog {
			return false, "Major: не логируйте токен/секрет в открытом виде"
		}
		return true, "OK"
	case "log_with_request_id":
		if !ctx.hasRequestIDInLog {
			return false, "Minor: добавьте в лог request id (например X-Request-ID) для контекста"
		}
		return true, "OK"
	default:
		// Fail-safe: неизвестная проверка не должна молча проходить.
		return false, "Проверка \"" + check + "\" не реализована для Go"
	}
}

// RunPython выполняет структурный анализ Python-кода через python_ast_validator.go.
// Комментарии и строковые литералы исключаются из анализа, вызовы функций и
// аргументы проверяются структурно — аналогично Go AST-валидатору.
func RunPython(rules []Rule, files []File) []RuleResult {
	ctx := runPythonASTChecks(files)
	results := make([]RuleResult, 0, len(rules))
	for _, rule := range rules {
		passed, msg := evaluatePythonRule(rule.Check, ctx)
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
