# Request / response anatomy

```http
METHOD /path/{id}?query=1 HTTP/1.1
Header-Name: value

optional body
```

```http
HTTP/1.1 STATUS
Header-Name: value

optional body
```

Ask every time: method · path · query · auth header/cookie · body · status · body shape
