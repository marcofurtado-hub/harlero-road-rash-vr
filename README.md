# HARLERO ROAD RASH 66 🏍️🔥🎸

Jogo de tiro em VR (WebXR) para o **Meta Quest 2/3**: você pilota uma Harley numa viagem infinita e procedural pelos EUA, passando por túneis, pontes altíssimas e ladeiras, enquanto ondas de gangues de motoqueiros punks tentam te derrubar. A cada onda vem uma arma nova e você monta sua "build" passando por portais de habilidade na estrada. Tudo com rock gerado ao vivo.

Não tem build, não tem dependências: é HTML + JavaScript puro com o Three.js (r170) vendorizado em `lib/`.

## Jogar agora

No **Meta Quest Browser**, abra **https://marcofurtado-hub.github.io/harlero-road-rash-vr/** e clique em **🥽 Entrar no VR**. Também está na VR ZONE do [Surtados Games](https://marcofurtado-hub.github.io/#vr).

## Rodar localmente no Quest

O WebXR só funciona em **HTTPS** (ou `localhost`). O `serve.py` gera um certificado autoassinado e serve o jogo na sua rede local:

```bash
python3 serve.py
```

1. Deixe o PC e o Quest **na mesma rede Wi-Fi**.
2. No Quest, abra o **Meta Quest Browser** e acesse o endereço que o script mostrar (ex.: `https://192.168.0.10:8443`).
3. O navegador vai avisar que a conexão não é privada (o certificado é autoassinado) → **Avançado → Prosseguir**.
4. Clique em **🥽 Entrar no VR**. Dá pra jogar **sentado** ou em pé: o jogo calibra a altura da cabeça sozinho.

> Alternativa sem certificado: com o Quest no cabo USB e modo desenvolvedor ligado, rode `adb reverse tcp:8000 tcp:8000`, depois `python3 serve.py --http` e abra `http://localhost:8000` no Quest.

## Controles

**VR (Touch controllers)**
| Ação | Como |
|---|---|
| Atirar | **Gatilho direito**. A arma fica sempre na mão direita, com munição infinita e mira assistida |
| Trocar arma | **A** (próxima) / **B** (anterior) |
| Pilotar com a mão | **mão esquerda**: segure o **GRIP** (em qualquer lugar) e gire o controle, mova a mão pro lado ou empurre/puxe |
| Pilotar com a cabeça | **incline a cabeça / o corpo** pro lado (tombar a cabeça também vira) |
| Pilotar (alternativo) | analógico ← → |
| **Acelerar** | segurando o GRIP esquerdo, **gire o punho pra trás** (bico do controle pra cima), como numa moto de verdade. Pra frente freia. Ou use o **gatilho esquerdo** |
| Acelerar / frear (alternativo) | analógico ↑ / ↓ |
| Buzina | **X** |
| Recentralizar | segure **Y** |
| Ligar/desligar música | clique no **analógico esquerdo** (ou atire na carta 🎸 MÚSICA no menu) |

Sem menus: **cada punk derrubado recupera um pouco de vida**. No fim de cada onda, um **caminhão desgovernado** passa costurando a pista, derruba um baú e a arma nova voa direto pra sua mão. Logo depois aparecem **3 portais de habilidade** atravessando a estrada (ATAQUE à esquerda, EFEITO no meio, DEFESA à direita): é só passar de moto pelo que você quer. Sem fazer nada, você pega o do meio.

**Acelerar vale a pena**: os pontos de cada abate são multiplicados pela velocidade (até x1,5 no talo), mas o trânsito e os obstáculos chegam mais rápido. Ladeira abaixo a moto embala sozinha.

**PC (para testar sem o headset)**: mouse mira e atira (clique no jogo pra prender o mouse; se o navegador não deixar, a mira segue o cursor), **A/D** pilota, **W/S** (ou Shift) acelera/freia, **1-9** ou rodinha troca a arma, **Espaço** buzina, **M** liga/desliga a música.

Para testar só no PC também dá pra usar `python3 serve.py --http` e abrir `http://localhost:8000`.

## O que tem no jogo

- **Trechos especiais na estrada**:
  - **Túnel 66**: boca de concreto cavada numa montanha de rocha, luminárias de sódio no teto, o mundo escurece lá dentro e o motor ecoa.
  - **Ponte do Desfiladeiro**: ponte em arco de aço enferrujado a 80 m de altura sobre um rio, com guarda-corpo baixo e **rajadas de vento** que empurram a moto.
  - **Descidas fortes e subidas leves**: dá pra ver a estrada despencando lá na frente.
  - Cada região tem seu tempero (o Grand Canyon tem mais pontes, a Redwood e Chicago mais túneis, o Death Valley mais ladeiras).
- **Viagem arcade pelos EUA (estilo Cruis'n USA)**: estrada procedural com curvas e morros de verdade (dá pra ver a pista subindo e descendo lá na frente; o céu gira quando você faz a curva) e **uma região nova a cada onda**: Arizona/Rota 66 → Grand Canyon (corredor de paredões) → Death Valley (sal branco) → Floresta de Redwood (sequoias gigantes) → Golden Gate (ponte suspensa sobre o mar, com o chefão) → Fazendas de Iowa (milharal, silos, moinhos) → Chicago (arranha-céus) → Washington D.C. (obelisco, Capitólio, cerejeiras) e recomeça.
- **Trânsito**: carros e picapes mais lentos na pista e outros te ultrapassando buzinando. Bater dói, e os punks também se arrebentam neles.
- **Ondas** com dificuldade crescente e um tipo de inimigo novo por onda. **Chefão na Golden Gate (onda 5) e o grande final em Washington (onda 8)**. Depois a viagem recomeça mais difícil, com chefão a cada 4 ondas.
- **7 tipos de inimigos + chefão**:
  - **Punk**: moicano e pistola. O básico.
  - **Correntão**: brutamontes com taco cravejado que encosta do seu lado e tenta te jogar pra fora da pista.
  - **Tocha**: arremessa molotovs que viram poças de fogo na pista. Dá pra estourar o molotov no ar.
  - **Dinamite**: kamikaze apitando que vem na sua direção. Mata antes e a explosão leva os vizinhos junto.
  - **Dupla Sidecar**: piloto + atirador de submetralhadora no sidecar.
  - **Brutamontes**: chopper gigante, colete blindado (mire na cabeça) e escopeta.
  - **Caveira**: sniper com mira laser vermelha. Quando o laser pisca, desvie!
  - **Chefão**: picape monstro com metralhadora giratória, foguetes teleguiados (dá pra derrubar no tiro), barris jogados na pista e reforços. Os tanques de combustível vermelhos são pontos fracos.
- **9 armas com munição infinita**, uma nova por onda: Escopeta Cano Duplo → Magnum .50 dourada (perfura) → Metralhadora → Bazuca → Escopeta Automática → Mini-Gatling → **Foguetes Teleguiados** (rajada de 3 mísseis que perseguem os punks) → **Flying V Laser** (uma guitarra que solta um feixe contínuo) → **Bobina Tesla** (raio que salta de punk em punk em cascata).
- **Habilidades estilo Archero** (a mesma lógica do Chicken Rancher), que mudam o tiro de forma visível e viram uma build:
  - Ataque: **Bala Dupla** e **Tiro em Leque** (valem pra TODAS as armas, até o laser e a tesla), Calibre Grosso, Gatilho Nervoso, Olho de Águia (crítico), Sangue Quente.
  - Efeito: Ricochete, Bala Incendiária, Bala Congelante, Bala Elétrica, Munição Explosiva, Bala Perfurante, Mira Magnética.
  - Defesa: **Corvo Atirador** (um corvo de bandana voa do seu lado e atira sozinho), Escudo Cromado, Jaqueta de Couro, Coração V8, Vampiro do Asfalto, Sorte Grande, Combo Mestre e o Pit Stop quando a vida está baixa.
  - Regras: a 1ª escolha sempre tem um ataque épico, chefão dá 2 rodadas de portais e às vezes aparece algo que você já tem pra subir de nível.
- **Power-ups** que caem dos punks (atire na caixa ou passe por cima): ⭐ Bala de Ouro (dano x3), 💣 Bala Explosiva, ⏳ Câmera Lenta (punks e balas a 35%), ❤️ Vida e 🎸 Fúria do Rock.
- **Caminhão desgovernado** entre as ondas, que derruba o baú com a arma nova (com câmera lenta quando ela salta).
- **Pista viva**: barris explosivos (atire neles perto dos punks!), carros abandonados, cones e trânsito.
- **Combos**, headshots, ragdoll dos punks voando, explosões em cadeia, vibração nos controles.
- **Rock procedural**: bateria, baixo, guitarra distorcida em estéreo e solos, que mudam de intensidade (menu, combate, chefão). Use fone!

## Estrutura

```
index.html        tela inicial + importmap
serve.py          servidor HTTPS local (certificado autoassinado em .cert/)
lib/three.module.js
js/main.js        loop, estados do jogo, VR/desktop, pontuação, explosões
js/player.js      moto, guidão (direção + acelerador), velocidade, habilidades, dano
js/weapons.js     armas, multi-tiro, efeitos de impacto (fogo/gelo/choque/ricochete), tesla, laser
js/skills.js      habilidades estilo Archero e regras das ofertas
js/gates.js       portais de habilidade na estrada
js/buddy.js       Corvo Atirador
js/features.js    túnel na montanha e ponte alta sobre o desfiladeiro
js/enemies.js     tipos de inimigos, IA, ataques, mortes, chefão
js/waves.js       diretor de ondas
js/upgrades.js    cartas 3D (menu e game over)
js/world.js       estrada, céu, cenário procedural, curvatura
js/hazards.js     barris, carros, cones, fogo, power-ups
js/projectiles.js balas inimigas, molotovs, foguetes, granadas, mísseis teleguiados
js/fx.js          partículas, traçantes, explosões, textos
js/audio.js       música e efeitos 100% sintetizados (Web Audio)
js/hud.js         painel no tanque, letreiros, barra do chefão
js/models.js      todos os modelos 3D procedurais (low-poly)
js/curve.js       gerador da pista (curvas, morros, descidas, túneis, pontes) + shader que leva o mundo plano pra estrada
js/scenery.js     modelos das regiões (cânion, sequoias, ponte, fazenda, cidade, D.C., trânsito)
```

Teste por script: `G.step(n)` avança n frames sem renderizar (funciona até com a aba escondida), ótimo pra rodar a campanha inteira com um robô no console.

Dicas de performance: tudo é low-poly com cor por vértice (poucas draw calls), sem sombras dinâmicas, com foveated rendering. Se quiser mais nitidez no Quest 3, abra com `?scale=1.3` no fim do endereço.
