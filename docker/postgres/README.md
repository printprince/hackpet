# Схема БД Hackpet

Файлы в `init/` выполняются при **первом** запуске контейнера Postgres (пустой volume). Повторный запуск контейнера не перезаписывает данные.

## Сущности и связи

```
users (id, email, nickname, password_hash)
  │
  ├── 1:1 pets (user_id PK, name, level, xp, mood_type)
  ├── N   user_module_progress (user_id, module_id, status, last_step, lab_attempt_count, …)
  ├── N   user_course_progress (user_id, course_id, status, completed_at, certificate_issued_at)
  ├── N   lab_attempts (user_id, lab_id, module_id, rule_results jsonb, …)
  └── N   quiz_answers (user_id, quiz_id, question_id, answer, correct)

courses (id, title, status, difficulty, total_minutes, sort_order)
  │
  └── N   course_modules (course_id, module_id, position)  ← порядок модулей в курсе

modules (id, title, summary, difficulty, minutes, topic, sort_order)
  │
  └── N   module_assets (module_id, asset_type: video|document|link|embed, url_or_path, position, duration_sec)
```

- **Пользователь**: авторизация по `email`, отображение по `nickname` (уникальный).
- **Питомец**: один на пользователя; `level`, `xp`, `mood_type` можно считать по прогрессу или хранить в БД для геймификации.
- **Курсы и модули**: каталог для будущего переноса из JSON / админки. Связь курс–модуль через `course_modules` с `position` (один модуль может быть в нескольких курсах).
- **module_assets**: задел под видео, PDF, ссылки внутри модуля; `position` — порядок вывода.
- **Прогресс**: по модулю (`user_module_progress`) и по курсу (`user_course_progress`); завершение курса и выдача сертификата — в `user_course_progress`.
- **lab_attempts**, **quiz_answers**: история попыток и ответов для аналитики и дообучения.

## Переход с файлового хранилища

Сейчас курсы и контент модулей (теория, квизы, лабы) читаются из JSON в `data/`. Таблицы `courses`, `modules`, `course_modules` можно заполнять при переносе в админку или оставить пустыми — тогда каталог по-прежнему из файлов, а в БД только пользователи, питомцы, прогресс и активность.
