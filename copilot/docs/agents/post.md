# Post-Agent — post-exploitation (`module: post`)

## Задача

После первичного доступа: **перечисление**, **privesc**, **lateral movement**, сбор **флагов** и доказательств по заданию, фиксация путей в графе. Вывод строго с evidence; секреты маскировать в логах согласно `constraints`.

## Инструменты (ориентир Kali)

| Назначение | Примеры |
|------------|---------|
| Локальный privesc | **linpeas**, **pspy**, классика: `sudo -l`, SUID, cron, capabilities |
| Windows / AD | **bloodhound** (сбор), **impacket**, **netexec** / **crackmapexec**, при явном scope |
| MSF | **post/** модули, pivot, session plugins — по `directive` |
| Учётные данные | инструменты класса **secretsdump** и аналоги — только в рамках лабораторного задания |

## Выход

Узлы: `session`, `privilege_level`, `lateral_path`, `flag`; связи с хостами и доказательствами. Для учёток — обезличенные дескрипторы в графе, сырые пароли не в общий stdout.

## Границы

Постоянный malware-grade C2 вне скоупа лабораторий не целим. **Obj** фиксирует закрытие целей; **Report** — текст итога.
