package validator

import "testing"

func resultsByCheck(rules []Rule, results []RuleResult) map[string]bool {
	idToCheck := map[string]string{}
	for _, r := range rules {
		idToCheck[r.ID] = r.Check
	}
	out := map[string]bool{}
	for _, res := range results {
		out[idToCheck[res.RuleID]] = res.Passed
	}
	return out
}

func goFiles(src string) []File { return []File{{Path: "main.go", Content: src}} }

var ssrfRules = []Rule{
	{ID: "r1", Check: "ssrf_url_scheme"},
	{ID: "r2", Check: "ssrf_host_allowlist"},
	{ID: "r3", Check: "ssrf_client_timeout"},
}

var logRules = []Rule{
	{ID: "r1", Check: "log_safe_user_error"},
	{ID: "r2", Check: "log_no_secrets"},
	{ID: "r3", Check: "log_with_request_id"},
}

const ssrfVulnerable = `package main

import (
	"net/http"
	"strings"
)

func isAllowedHost(host string) bool {
	allowed := []string{"api.example.com"}
	for _, h := range allowed {
		if strings.EqualFold(host, h) {
			return true
		}
	}
	return false
}

func proxyHandler(w http.ResponseWriter, r *http.Request) {
	target := r.URL.Query().Get("url")
	resp, err := http.Get(target)
	if err != nil {
		http.Error(w, "request failed", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()
	w.WriteHeader(http.StatusOK)
}
`

const ssrfSolved = `package main

import (
	"net/http"
	"net/url"
	"strings"
	"time"
)

func isAllowedHost(host string) bool {
	allowed := []string{"api.example.com"}
	for _, h := range allowed {
		if strings.EqualFold(host, h) {
			return true
		}
	}
	return false
}

func proxyHandler(w http.ResponseWriter, r *http.Request) {
	target := r.URL.Query().Get("url")
	u, err := url.Parse(target)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || !isAllowedHost(u.Hostname()) {
		http.Error(w, "bad target", http.StatusBadRequest)
		return
	}
	client := &http.Client{Timeout: 3 * time.Second}
	_, _ = client.Get(u.String())
	w.WriteHeader(http.StatusOK)
}
`

const logVulnerable = `package main

import (
	"log"
	"net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	err := doWork()
	if err != nil {
		http.Error(w, "internal error: "+err.Error()+" token="+token, http.StatusInternalServerError)
		log.Printf("work failed token=%s err=%v", token, err)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func doWork() error { return nil }
`

const logSolved = `package main

import (
	"log"
	"net/http"
)

func handler(w http.ResponseWriter, r *http.Request) {
	token := r.Header.Get("Authorization")
	err := doWork()
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		log.Printf("work failed req=%s err=%v", r.Header.Get("X-Request-ID"), err)
		_ = token
		return
	}
	w.WriteHeader(http.StatusOK)
}

func doWork() error { return nil }
`

func TestSSRFVulnerableFails(t *testing.T) {
	got := resultsByCheck(ssrfRules, Run(ssrfRules, goFiles(ssrfVulnerable)))
	for _, c := range []string{"ssrf_url_scheme", "ssrf_host_allowlist", "ssrf_client_timeout"} {
		if got[c] {
			t.Errorf("уязвимый SSRF-стартер должен проваливать %q, но прошёл", c)
		}
	}
}

func TestSSRFSolvedPasses(t *testing.T) {
	got := resultsByCheck(ssrfRules, Run(ssrfRules, goFiles(ssrfSolved)))
	for _, c := range []string{"ssrf_url_scheme", "ssrf_host_allowlist", "ssrf_client_timeout"} {
		if !got[c] {
			t.Errorf("корректное SSRF-решение должно проходить %q, но провалилось", c)
		}
	}
}

func TestLogVulnerableFails(t *testing.T) {
	got := resultsByCheck(logRules, Run(logRules, goFiles(logVulnerable)))
	for _, c := range []string{"log_safe_user_error", "log_no_secrets", "log_with_request_id"} {
		if got[c] {
			t.Errorf("уязвимый logging-стартер должен проваливать %q, но прошёл", c)
		}
	}
}

func TestLogSolvedPasses(t *testing.T) {
	got := resultsByCheck(logRules, Run(logRules, goFiles(logSolved)))
	for _, c := range []string{"log_safe_user_error", "log_no_secrets", "log_with_request_id"} {
		if !got[c] {
			t.Errorf("корректное logging-решение должно проходить %q, но провалилось", c)
		}
	}
}

func TestUnknownCheckFailsSafe(t *testing.T) {
	rules := []Rule{{ID: "r1", Check: "totally_unknown_check"}}
	res := Run(rules, goFiles(ssrfSolved))
	if res[0].Passed {
		t.Errorf("неизвестная проверка не должна молча проходить (fail-safe)")
	}
}
