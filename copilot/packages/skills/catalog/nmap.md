# nmap (справка для агента)

Кратко: сканирование портов и сервисов.

## Базовые примеры

- SYN top ports: `sudo nmap -sS -sV -Pn --top-ports 1000 -T4 TARGET`
- Версии и скрипты: `nmap -sV -sC -Pn TARGET`
- Один порт: `nmap -p 443 -sV -Pn TARGET`

## Вывод

Используй строки `open`, `VERSION`, `SCRIPT` как факты только после того, как они есть в захваченном stdout.
