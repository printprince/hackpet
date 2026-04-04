# Ответы на лабы модулей

Скопируй нужный блок кода в редактор лабы и отправь на проверку. В курсе DevSecOps: Python у каждой лабы несколько проверок (правила) — решения ниже проходят все из них.

---

## 1. Path Traversal (path-traversal)

```go
package main

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"
)

const baseDir = "./files"

func downloadHandler(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("file")
	if filename == "" {
		http.Error(w, "missing file", http.StatusBadRequest)
		return
	}
	clean := filepath.Clean(filepath.Join(baseDir, filename))
	rel, err := filepath.Rel(baseDir, clean)
	if err != nil || strings.Contains(rel, "..") {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	f, err := os.Open(clean)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	defer f.Close()
	// serve file
}
```

---

## 2. SSRF (go-ssrf)

```go
package main

import (
	"net/http"
	"net/url"
	"strings"
	"time"
)

func isAllowedHost(host string) bool {
	allowed := []string{"api.example.com", "status.example.com"}
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
```

---

## 3. Безопасные ошибки и логирование (go-logging-errors)

```go
package main

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
		_ = token // не логируем секрет
		return
	}
	w.WriteHeader(http.StatusOK)
}

func doWork() error { return nil }
```

---

## 4. Path Traversal (python-path-traversal)

```python
from flask import Flask, request, abort, send_file
import os

app = Flask(__name__)
BASE_DIR = "/app/files"

@app.route("/download")
def download():
    filename = request.args.get("file")
    if not filename:
        abort(400)

    joined = os.path.join(BASE_DIR, filename)
    safe_path = os.path.normpath(joined)

    if os.path.commonpath([BASE_DIR, safe_path]) != BASE_DIR:
        abort(403)

    if not os.path.exists(safe_path):
        abort(404)

    return send_file(safe_path)
```

---

## 5. SSRF (python-ssrf)

```python
import ipaddress
from urllib.parse import urlparse

import requests
from flask import Flask, request, abort

app = Flask(__name__)

ALLOWED_HOSTS = {"api.example.com", "status.example.com"}


def is_private_or_loopback(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
        return ip.is_private or ip.is_loopback
    except ValueError:
        return False


@app.route("/proxy")
def proxy():
    raw_url = request.args.get("url")
    if not raw_url:
        abort(400)

    u = urlparse(raw_url)
    if u.scheme not in ("http", "https"):
        abort(400)

    host = u.hostname or ""
    if host not in ALLOWED_HOSTS or is_private_or_loopback(host):
        abort(403)

    resp = requests.get(u.geturl(), timeout=3)
    return resp.content
```

---

## 6. Безопасные ошибки и логирование (python-logging-errors)

```python
import logging
from flask import Flask, request, abort

app = Flask(__name__)
log = logging.getLogger(__name__)

@app.route("/pay")
def pay():
    token = request.headers.get("Authorization")
    try:
        raise RuntimeError("payment failed")
    except Exception as exc:
        request_id = request.headers.get("X-Request-ID")
        log.error(
            "payment failed",
            extra={
                "path": request.path,
                "request_id": request_id,
                "error": str(exc),
            },
        )
        # не возвращаем пользователю детали ошибки и не логируем токен целиком
        _ = token
        abort(500, "Внутренняя ошибка. Попробуйте позже.")
```

---

## 7. SQL Injection (python-sql-injection)

```python
import sqlite3
from flask import Flask, request, abort

app = Flask(__name__)

@app.route("/user")
def user():
    name = request.args.get("name")
    if not name:
        abort(400)

    conn = sqlite3.connect("app.db")
    cur = conn.cursor()
    query = "SELECT * FROM users WHERE name = ?"
    cur.execute(query, (name,))
    rows = cur.fetchall()
    return str(rows)
```

---

## 8. XSS (python-xss)

```python
from flask import Flask, request, render_template_string

app = Flask(__name__)

@app.route("/hello")
def hello():
    name = request.args.get("name", "гость")
    return render_template_string("<h1>Привет, {{ name }}!</h1>", name=name)
```

---

## 9. CTF-челлендж (DevSecOps: Python)

Стенд — «Библиотека учебного центра». В поиске строка «По запросу «…»» подставляется в страницу **без экранирования** (отражённый XSS). Флаг лежит в скрытом элементе на странице.

**Как пройти:**

1. Открой стенд по кнопке «Открыть стенд».
2. В поле поиска введи один из payload (как есть) и нажми «Искать»:
   - `<script>alert(document.getElementById('secret-flag').innerText)</script>`
   - или: `<img src=x onerror="alert(document.getElementById('secret-flag').innerText)">`
3. В всплывающем окне появится флаг `HACKPET{python_xss_dom_flag}`.
4. Скопируй флаг и вставь его в поле «Введите найденный флаг» на странице CTF в курсе, нажми «Отправить флаг».

**Почему так:** запрос из поиска подставляется в страницу без экранирования (в скрытом блоке), браузер выполняет скрипт. Элемент с флагом уже есть в начале страницы, поэтому `getElementById('secret-flag')` его находит.
