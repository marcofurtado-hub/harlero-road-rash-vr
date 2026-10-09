# HARLERO ROAD RASH 66 🏍️🔥🎸

Jogo de tiro em VR (WebXR) para o **Meta Quest 2/3**: você pilota uma Harley numa viagem infinita e procedural pelos EUA, passando por túneis, pontes altíssimas e ladeiras, enquanto ondas de gangues de motoqueiros punks tentam te derrubar. A cada onda um caminhão de entregas desgovernado derruba uma arma nova e caixas de vida e power-up na pista. Morreu, morreu. Tudo com rock gerado ao vivo.

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
| Atirar | **Gatilho direito**. A arma fica sempre na mão direita, com munição infinita. Sem mira assistida: um laser com pontinho vermelho mostra onde a bala vai bater |
| Trocar arma | **A** (próxima) / **B** (anterior) |
| Pilotar com a mão | **mão esquerda**: segure o **GRIP** (em qualquer lugar) e gire o controle, mova a mão pro lado ou empurre/puxe |
| Pilotar com a cabeça | **incline a cabeça / o corpo** pro lado (tombar a cabeça também vira) |
| Pilotar (alternativo) | analógico ← → |
| **Acelerar** | **gatilho esquerdo** (analógico: quanto mais aperta, mais rápido, até ~300 km/h; descendo ladeira passa disso) |
| Acelerar / frear (alternativo) | analógico ↑ / ↓ |
| Buzina | **X** |
| Recentralizar | segure **Y** |
| Ligar/desligar música | clique no **analógico esquerdo** (ou atire na carta 🎸 MÚSICA no menu) |

Sem menus e sem upgrades: **cada punk derrubado recupera só um pouquinho de vida**. No fim de cada onda, um **caminhão de entregas da 66 EXPRESS** passa desgovernado costurando a pista, derruba uma encomenda (caixa de papelão com fita e etiqueta, ou engradado de madeira) e a arma nova voa direto pra sua mão. A carga também se espalha pela pista: **caixas de vida e power-up** (2 por onda, 4 depois de chefão). Atire nelas ou passe por cima.

**Acelerar vale a pena**: os pontos de cada abate são multiplicados pela velocidade (até x2 no talo), mas o trânsito e os obstáculos chegam mais rápido. Ladeira abaixo a moto embala sozinha, e as **rampas** fazem a moto voar (quanto mais rápido, mais alto; voo longo dá pontos).

**PC (para testar sem o headset)**: mouse mira e atira (clique no jogo pra prender o mouse; se o navegador não deixar, a mira segue o cursor), **A/D** pilota, **W/S** (ou Shift) acelera/freia, **1-9** ou rodinha troca a arma, **Espaço** buzina, **M** liga/desliga a música.

Para testar só no PC também dá pra usar `python3 serve.py --http` e abrir `http://localhost:8000`.

## O que tem no jogo

- **Trechos especiais na estrada**:
  - **Túnel 66**: boca de concreto cavada numa montanha de rocha, luminárias de sódio no teto, o mundo escurece lá dentro e o motor ecoa.
  - **Ponte do Desfiladeiro**: ponte em arco de aço enferrujado a 80 m de altura sobre um rio, com guarda-corpo baixo e **rajadas de vento** que empurram a moto.
  - **Descidas absurdas**: trechos de quase 1 km despencando mais de 100 m, com uma **rampa de largada** no topo pra você voar por cima da descida.
  - **Rampas** amarelas e pretas no meio da pista (às vezes numa faixa só, às vezes na estrada inteira), muitas vezes com a pista caindo logo depois.
  - Descidas fortes e subidas leves no resto do caminho.
  - Cada região tem seu tempero (o Grand Canyon tem mais pontes, a Redwood e Chicago mais túneis, o Death Valley mais ladeiras).
- **Neblina com a cor do céu**: o que está longe some exatamente na cor do céu atrás dele (degradê e brilho do sol), sem aquele recorte branco.
- **Golden Gate de verdade**: você chega por morros verdes com ciprestes e entra na ponte suspensa sobre a baía.
- **Viagem arcade pelos EUA (estilo Cruis'n USA)**: estrada procedural com curvas e morros de verdade (dá pra ver a pista subindo e descendo lá na frente; o céu gira quando você faz a curva) e **uma região nova a cada onda**: Arizona/Rota 66 → Grand Canyon (corredor de paredões) → Death Valley (sal branco) → Floresta de Redwood (sequoias gigantes) → Golden Gate (ponte suspensa sobre o mar, com o chefão) → Fazendas de Iowa (milharal, silos, moinhos) → Chicago (arranha-céus) → Washington D.C. (obelisco, Capitólio, cerejeiras) e recomeça.
- **Trânsito**: carros e picapes mais lentos na pista e outros te ultrapassando buzinando. Bater dói, e os punks também se arrebentam neles.
- **Ondas** com dificuldade crescente e um tipo de inimigo novo por onda. **Chefão na Golden Gate (onda 5) e o grande final em Washington (onda 8)**. Depois a viagem recomeça mais difícil, com chefão a cada 4 ondas.
- **10 tipos de inimigos + chefão** (um tipo novo quase toda onda):
  - **Punk**: moicano e pistola. O básico.
  - **Correntão**: brutamontes com taco cravejado que encosta do seu lado e tenta te jogar pra fora da pista.
  - **Tocha**: arremessa molotovs que viram poças de fogo na pista. Dá pra estourar o molotov no ar.
  - **Dinamite**: kamikaze apitando que vem na sua direção. Mata antes e a explosão leva os vizinhos junto.
  - **Dupla Sidecar**: piloto + atirador de submetralhadora no sidecar.
  - **Brutamontes**: chopper gigante, colete blindado (mire na cabeça) e escopeta.
  - **Caveira**: sniper com mira laser vermelha. Quando o laser pisca, desvie!
  - **Autogiro**: punk voando por cima da estrada, atirando de cima e soltando bombas na sua faixa (dá pra estourar a bomba no ar).
  - **Escudeiro**: escudo de choque na frente do peito. Mire na cabeça.
  - **Muscle Car**: conversível com chamas no capô, um atirador em pé no banco de trás e trombada que dói.
- **3 chefões que se revezam** (todos ficam FURIOSOS abaixo de 50% de vida: atacam mais rápido e ganham ataques novos). As peças vermelhas com faixa amarela são pontos fracos:
  - **Big Mama e sua picape** (onda 5): metralhadora giratória, foguetes, barris, **trombada** (recua até você e joga pro seu lado), **chuva de molotov** (sempre sobra uma faixa livre) e reforços.
  - **Urubu de Aço, o helicóptero da gangue** (onda 8): voa na sua frente metralhando e soltando foguetes, faz **rasantes por cima de você bombardeando a sua faixa** e chama autogiros.
  - **Caminhão-tanque do Capeta** (onda 12): **lança-chamas** que bota fogo na pista à sua frente, trombada, barris e foguetes.
- **9 armas com munição infinita**, uma nova por onda: Escopeta Cano Duplo → Magnum .50 dourada (perfura) → Metralhadora → Bazuca → Escopeta Automática → Mini-Gatling → **Foguetes Teleguiados** (rajada de 3 mísseis que perseguem os punks) → **Flying V Laser** (uma guitarra que solta um feixe contínuo) → **Bobina Tesla** (raio que salta de punk em punk em cascata).
- **Power-ups** que caem dos punks (atire na caixa ou passe por cima): ⭐ Bala de Ouro (dano x3), 💣 Bala Explosiva, ⏳ Câmera Lenta (punks e balas a 35%), 🐦 Corvo de Aluguel (8 s), ❤️ Vida e 🎸 Fúria do Rock.
- **Difícil de verdade**: cada punk derrubado cura só um pouquinho, as ondas vêm cheias e os inimigos batem forte.
- **Modelos de arma caprichados** (canos azulados, madeira envernizada, Magnum dourada com tambor estriado, Thompson com tambor e cano aletado...) com material brilhante.
- **Armas com a sensação do Chicken Rancher**: balas de verdade voando (60 a 120 m/s, colisão por segmento), espalhamento, coice curto, vibração e sons copiados do rancho. A gatling gira os 6 canos e atira na hora, sem aquecer.
- **Caminhão desgovernado** entre as ondas, que derruba a encomenda com a arma nova (com câmera lenta quando ela salta).
- **Pista viva**: barris explosivos (atire neles perto dos punks!), cones e trânsito. **Carros explodem depois de alguns tiros** (e levam os punks do lado junto, em reação em cadeia).
- **Manchas de óleo** que fazem a moto escorregar de lado (e derrubam punks) e **faixas de turbo** com setas que dão um empurrão de velocidade.
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
js/buddy.js       corvo ajudante (power-up)
js/skyfog.js      neblina com a cor do céu
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
