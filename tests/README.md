# Testes

Rodam com Node, sem instalar nada e sem internet.

```bash
node tests/api.test.js     # servidor (Apps Script) com Sheets, Drive e Cache simulados
node tests/front.test.js   # telas com DOM, fetch e localStorage simulados
```

Antes de publicar uma versão, rode os dois. Para testar uma regra nova do servidor, acrescente o caso em `tests/api.test.js`.
