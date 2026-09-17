# Atividade — Publicação Colaborativa de Dados no GeoEdu Portal UFMA

## Objetivo
Aprender a preparar, validar e submeter um produto geoespacial para um projeto WebGIS colaborativo utilizando QGIS, GeoEdu Portal UFMA e GitHub, sem necessidade de programação.

## Produto da atividade
Cada grupo deverá submeter **um arquivo GeoJSON validado**, acompanhado dos metadados mínimos, por meio de um Pull Request.

## Etapa 1 — Preparar no QGIS
1. Trabalhe a base definida na atividade.
2. Verifique fonte, geometria, atributos e SRC.
3. Realize os processamentos solicitados.
4. Gere uma cópia destinada à Web.
5. Exporte como GeoJSON em **EPSG:4326 — WGS 84**, UTF-8.
6. Use o padrão de nome da disciplina.

## Etapa 2 — Testar no GeoEdu
1. Abra o GeoEdu Portal UFMA.
2. Em **Laboratório Acadêmico**, clique em **Adicionar GeoJSON**.
3. Selecione o arquivo do grupo.
4. Confirme a localização, geometria e enquadramento.
5. Clique em algumas feições e confira os atributos.
6. Corrija o arquivo no QGIS se houver problemas.
7. Somente prossiga quando a camada estiver adequada.

## Etapa 3 — Criar um Fork
1. Entre na sua conta do GitHub pelo navegador.
2. Abra o repositório oficial `mauriciorangel-geodesign/geoedu-portal-ufma`.
3. Clique em **Fork**.
4. Mantenha o nome sugerido para o repositório.
5. Clique em **Create fork**.

O fork é uma cópia do projeto na conta do estudante/grupo. Trabalhar nele não modifica diretamente o portal oficial.

## Etapa 4 — Fazer Upload
No fork do grupo:

### Geoprocessamento
Acesse `data/geoprocessamento/projetos_alunos/`.

### Sensoriamento Remoto
Acesse `data/sensoriamento_remoto/projetos_alunos/`.

Depois:
1. Clique em **Add file → Upload files**.
2. Selecione ou arraste o GeoJSON.
3. Confira o nome do arquivo.
4. Em **Commit changes**, escreva uma mensagem descritiva, por exemplo: `Add Group 03 Maranhão road network`.
5. Confirme o commit.

## Etapa 5 — Criar o Pull Request
1. Retorne à página principal do fork.
2. Utilize **Contribute → Open pull request** ou a opção equivalente apresentada pelo GitHub.
3. Confirme que a comparação envia alterações do fork do grupo para o repositório oficial.
4. Utilize como título: `DISCIPLINA ANO — Grupo NN — Tema`.
5. Preencha integralmente o modelo de metadados.
6. Clique em **Create pull request**.

## Etapa 6 — Revisão
Após a submissão, o Professor/GEOPRO poderá:
- aprovar o produto para incorporação ao acervo acadêmico;
- solicitar alterações;
- registrar observações técnicas ou acadêmicas;
- encerrar a submissão sem incorporação, quando necessário.

Quando houver solicitação de correção, o grupo deverá responder à revisão e realizar os ajustes necessários. Se a correção envolver o arquivo geoespacial, o produto deverá ser corrigido e atualizado no fork; novos commits associados ao mesmo trabalho poderão atualizar o Pull Request existente.

## Etapa 7 — Entender os estados do produto
A submissão pode passar por três estados conceituais:

1. **Em avaliação:** o Pull Request está aberto e sendo analisado.
2. **Aprovado para o acervo:** o produto foi aprovado e incorporado ao repositório oficial por Merge.
3. **Publicado no GeoPortal:** o Professor/GEOPRO selecionou posteriormente o produto para aparecer como camada na interface cartográfica do GeoEdu.

**Atenção:** um trabalho aprovado e incorporado ao acervo não aparece automaticamente no mapa. A publicação cartográfica é uma etapa posterior, realizada sob responsabilidade do Professor/GEOPRO.

## Entrega considerada completa
A atividade estará formalmente submetida quando existir um Pull Request contendo o produto no diretório correto, nomenclatura adequada, metadados preenchidos e confirmação do teste no Laboratório GeoEdu.

A submissão completa não implica aprovação automática. Da mesma forma, a aprovação para o acervo não implica publicação automática no GeoPortal.

## O que o estudante aprende
A atividade articula preparação de dados geoespaciais, SRC, qualidade geométrica, atributos, generalização, publicação WebGIS, documentação, controle de versão, revisão por pares/supervisão e colaboração científica.
