# GeoEdu Lab — Intersection v3.2.0-exp1 (protótipo)

**Não publicado no GitHub Pages. Não mesclar sem validar.**

## Execução local isolada
1. Baixe o ZIP desta branch (Code > Download ZIP) e extraia.
2. Abra um terminal na pasta que contém `index.html`.
3. Execute `py -m http.server 8000` (Windows com Python instalado), ou `python -m http.server 8000`.
4. Acesse `http://localhost:8000/` e confirme `v3.2.0-exp1` no rodapé.
5. Encerre o servidor com Ctrl+C.

## Testes obrigatórios
| Cenário | Limiar (m²) | Resultado esperado |
| --- | ---: | --- |
| Caso 01: contato por borda | 0 | 1 falso positivo pequeno pode reaparecer; registrar área |
| Caso 01: contato por borda | 0.05 | 0 feições; 1 filtrada |
| Caso 02: sobreposição real de 0.020 m² | 0 | 1 feição preservada |
| Caso 02: sobreposição real de 0.020 m² | 0.05 | 0 feições; 1 filtrada |

O experimento com limiar 0 é **diagnóstico**, não solução topológica. A função `turf.area` fornece área geodésica aproximada; conferir no QGIS em EPSG:31983. Registrar contagens, áreas e exportações GeoJSON. Repetir três cenários anteriores de regressão antes de considerar merge.

**Limitação:** não é possível determinar somente pela área se uma pequena sobreposição é real ou artefato. É necessária informação sobre precisão/proveniência e/ou restrições topológicas conhecidas.
