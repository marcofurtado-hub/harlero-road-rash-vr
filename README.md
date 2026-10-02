# HARLERO ROAD RASH 66 🏍️🔥🎸

Jogo de tiro em VR (WebXR) para o **Meta Quest 2/3**: você pilota uma moto numa Rota 66 infinita e procedural, ao pôr do sol, enquanto ondas de gangues de motoqueiros punks tentam te derrubar. Pegue as armas nos coldres, mande bala e fique cada vez mais forte com as cartas de upgrade. Tudo com rock gerado ao vivo.

Não tem build, não tem dependências: é HTML + JavaScript puro com o Three.js (r170) vendorizado em `lib/`.

## Como jogar no Quest

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
| Ação | Botão |
|---|---|
| Pegar arma | leve a mão até um coldre (perto das coxas, os aros dourados) e aperte **GRIP** |
| Guardar / trocar arma | aperte **GRIP** perto de um coldre (com outra arma: troca) |
| Atirar | **Gatilho** (as automáticas atiram enquanto segura) |
| Pilotar | **Analógico** ← → |
| Acelerar / frear | **Analógico esquerdo** ↑ / ↓ |
| Buzina | **A / X** |
| Recentralizar | segure **B / Y** |

Recarga: automática quando o pente acaba, com o giro de pistoleiro. Arma guardada no coldre recarrega sozinha. Dá pra usar duas armas, uma em cada mão.

**PC (para testar sem o headset)**: mouse mira e atira (clique no jogo pra prender o mouse; se o navegador não deixar, a mira segue o cursor), **A/D** pilota, **W/S** acelera/freia, **1-4** ou rodinha troca a arma, **R** recarrega, **Espaço** buzina.

Para testar só no PC também dá pra usar `python3 serve.py --http` e abrir `http://localhost:8000`.

## O que tem no jogo

- **Estrada infinita procedural**: curvas e morros, deserto, mesas, cactos, postes, placas US 66, outdoors, lanchonete com neon, tumbleweeds, pôr do sol retrô.
- **Ondas** com dificuldade crescente (mais inimigos, mais vida, mais dano, mira melhor) e **chefão a cada 5 ondas**.
- **7 tipos de inimigos + chefão**:
  - **Punk**: moicano e pistola. O básico.
  - **Correntão**: brutamontes com taco cravejado que encosta do seu lado e tenta te jogar pra fora da pista.
  - **Tocha**: arremessa molotovs que viram poças de fogo na pista. Dá pra estourar o molotov no ar.
  - **Dinamite**: kamikaze apitando que vem na sua direção. Mata antes e a explosão leva os vizinhos junto.
  - **Dupla Sidecar**: piloto + atirador de submetralhadora no sidecar.
  - **Brutamontes**: chopper gigante, colete blindado (mire na cabeça) e escopeta.
  - **Caveira**: sniper com mira laser vermelha. Quando o laser pisca, desvie!
  - **Chefão**: picape monstro com metralhadora giratória, foguetes teleguiados (dá pra derrubar no tiro), barris jogados na pista e reforços. Os tanques de combustível vermelhos são pontos fracos.
- **9 armas**, cada vez mais fortes: Revólver .44 → Escopeta Serrada → Uzi → Hand Cannon .50 dourada (perfura) → Tommy Gun → Escopeta Automática → Lança-Granadas → Mini-Gatling → **Flying V Laser** (uma guitarra que solta um feixe contínuo).
- **Upgrades entre ondas**: atire numa de 3 cartas (nova arma, turbinar arma até o nível 5, ou perks como munição explosiva, bala perfurante, vampiro, tempo de bala, jaqueta blindada e regeneração).
- **Pista viva**: barris explosivos (atire neles perto dos punks!), carros abandonados, cones, caixas de vida e a palheta **Fúria do Rock** (dano dobrado por 10 s, com solo de guitarra).
- **Combos**, headshots, ragdoll dos punks voando, explosões em cadeia, vibração nos controles.
- **Rock procedural**: bateria, baixo, guitarra distorcida em estéreo e solos, que mudam de intensidade (menu, combate, chefão). Use fone!

## Estrutura

```
index.html        tela inicial + importmap
serve.py          servidor HTTPS local (certificado autoassinado em .cert/)
lib/three.module.js
js/main.js        loop, estados do jogo, VR/desktop, pontuação, explosões
js/player.js      moto, controles, coldres, pegar/guardar armas, dano
js/weapons.js     armas, hitscan, granadas, feixe laser, recarga
js/enemies.js     tipos de inimigos, IA, ataques, mortes, chefão
js/waves.js       diretor de ondas
js/upgrades.js    cartas 3D (menu, upgrades, game over) e perks
js/world.js       estrada, céu, cenário procedural, curvatura
js/hazards.js     barris, carros, cones, fogo, itens
js/projectiles.js balas inimigas, molotovs, foguetes, granadas
js/fx.js          partículas, traçantes, explosões, textos
js/audio.js       música e efeitos 100% sintetizados (Web Audio)
js/hud.js         painel no tanque, letreiros, barra do chefão
js/models.js      todos os modelos 3D procedurais (low-poly)
js/curve.js       shader de "mundo curvo" (curvas e morros)
```

Dicas de performance: tudo é low-poly com cor por vértice (poucas draw calls), sem sombras dinâmicas, com foveated rendering. Se quiser mais nitidez no Quest 3, abra com `?scale=1.3` no fim do endereço.
