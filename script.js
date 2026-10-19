/* =========================================================
   ELDORIA - RPG DE TABULEIRO
   VERSÃO COM CORREÇÃO NO HIT KILL GERAL
========================================= */

const IMAGES = {
    player: 'Imagens/WhatsApp Image 2026-10-03 at 16.32.21.jpeg',
    skeleton: 'Imagens/WhatsApp Image 2026-10-03 at 16.32.21 (1).jpeg',
    encourado: 'Imagens/Encourado_02.webp',
    reptile: 'Imagens/WhatsApp Image 2026-10-03 at 16.32.20 (3).jpeg',
    bat: 'Imagens/WhatsApp Image 2026-10-03 at 16.32.20 (2).jpeg',
    fish: 'Imagens/WhatsApp Image 2026-10-03 at 16.32.20 (1).jpeg',
    wolf: 'Imagens/WhatsApp Image 2026-10-03 at 16.32.20.jpeg'
};

const SKILLS = {
    guerreiro: { name: 'Golpe Brutal', attackBonus: 12, critical: 0.25, heal: 0, description: 'Ataque pesado com maior hipótese de crítico.' },
    arqueiro: { name: 'Flecha Precisa', attackBonus: 8, critical: 0.40, heal: 0, description: 'Disparo rápido e alta hipótese de crítico.' },
    mago: { name: 'Chama Arcana', attackBonus: 16, critical: 0.15, heal: 0, description: 'Dano mágico massivo com grande consumo de energia.' },
    paladino: { name: 'Bênção Divina', attackBonus: 6, critical: 0.10, heal: 25, description: 'Causa dano moderado e restaura 25 HP.' }
};

const ENEMIES = {
    skeleton: { name: 'Corpo Seco', hp: 45, attack: 12, image: IMAGES.skeleton },
    encourado: { name: 'Encourado', hp: 60, attack: 15, image: IMAGES.encourado },
    reptile: { name: 'Mapin Guarin', hp: 80, attack: 18, image: IMAGES.reptile },
    bat: { name: 'Morcego Gigante', hp: 95, attack: 22, image: IMAGES.bat },
    fish: { name: 'Cabloco d´água', hp: 115, attack: 25, image: IMAGES.fish },
    wolf: { name: 'Lobisomem', hp: 160, attack: 30, image: IMAGES.wolf, boss: true }
};

const PHASES = [
    { name: 'Cavernas Sinistras', bossKey: 'skeleton', enemies: ['skeleton', 'encourado'], multiplier: 1.00 },
    { name: 'Pântano Sombrio', bossKey: 'encourado', enemies: ['skeleton', 'encourado', 'reptile'], multiplier: 1.20 },
    { name: 'Ruínas Perdidas', bossKey: 'reptile', enemies: ['encourado', 'reptile', 'bat'], multiplier: 1.40 },
    { name: 'Ninho da Noite', bossKey: 'bat', enemies: ['reptile', 'bat', 'fish'], multiplier: 1.65 },
    { name: 'Abismo Submerso', bossKey: 'fish', enemies: ['bat', 'fish', 'encourado'], multiplier: 1.90 },
    { name: 'Covil do Lobo', bossKey: 'wolf', enemies: ['fish', 'bat', 'reptile'], multiplier: 2.20, boss: true }
];

const state = {
    phase: 0,
    position: 0,
    hp: 100,
    maxHp: 100,
    xp: 0,
    level: 1,
    coins: 20,
    potions: 3,
    skillUses: 10,
    baseAttack: 16,
    baseDefense: 5,
    skillKey: 'guerreiro',
    enemiesDefeated: 0,
    defending: false,
    inBattle: false,
    enemy: null,
    board: [],
    loadingTimer: null,
    busy: false,
    pendingNextPhase: false,
    crownBattle: false,
    crownEnemyKey: null,
    encounterQueue: [],
    lastEnemyKey: null,
    skippedEnemies: [],
    battleQueue: [],
    currentEncounterKey: null,
    
    // LOJA DE MOEDAS
    healBoughtThisPhase: false,
    hitkillUsedThisGame: false
};

const $ = id => document.getElementById(id);

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const el = $(id);
    if (el) el.classList.add('active');
}

function log(message) {
    const box = $('game-log');
    if (!box) return;
    const p = document.createElement('p');
    p.textContent = message;
    box.prepend(p);
}

function updatePlayerUI() {
    $('player-level').textContent = state.level;
    $('hp-text').textContent = `${Math.max(0, state.hp)} / ${state.maxHp}`;
    $('xp-text').textContent = `${state.xp} / 100`;
    
    const hpPct = Math.max(0, (state.hp / state.maxHp) * 100);
    $('hp-bar').style.width = `${hpPct}%`;
    $('xp-bar').style.width = `${Math.max(0, Math.min(100, state.xp))}%`;
    
    $('attack-value').textContent = state.baseAttack;
    $('defense-value').textContent = state.baseDefense;
    $('coins-value').textContent = state.coins;
    $('potions-value').textContent = state.potions;
    
    $('active-skill-display').textContent = `${SKILLS[state.skillKey].name} (${state.skillUses} usos)`;
    
    const skillBtn = $('skill-button');
    if (skillBtn) {
        skillBtn.disabled = state.skillUses <= 0;
    }

    // Atualiza Botões da Loja
    const healBtn = $('buy-heal-button');
    if (healBtn) {
        healBtn.disabled = state.healBoughtThisPhase || state.coins < 50;
        if (state.healBoughtThisPhase) {
            healBtn.textContent = '💖 Cura Usada nesta Fase';
        } else {
            healBtn.textContent = '💖 Cura Total (50 ◈)';
        }
    }

    const hitkillBtn = $('buy-hitkill-button');
    if (hitkillBtn) {
        hitkillBtn.disabled = state.hitkillUsedThisGame || state.coins < 150;
        if (state.hitkillUsedThisGame) {
            hitkillBtn.textContent = '⚡ Hit Kill Esgotado';
        } else {
            hitkillBtn.textContent = '⚡ Hit Kill Geral (150 ◈)';
        }
    }

    $('objective-text').textContent = state.phase < PHASES.length - 1
        ? `Derrote os inimigos e chegue à ♛ coroa para enfrentar ${ENEMIES[PHASES[state.phase].bossKey].name}.`
        : 'Derrote o chefe final e salve Eldoria.';
}

function buyInstantHeal() {
    if (state.healBoughtThisPhase) {
        log('⚠️ Você já comprou a Cura Total nesta fase! Avance de fase para liberar novamente.');
        return;
    }
    if (state.coins < 50) {
        log('❌ Moedas insuficientes! A Cura Total custa 50 moedas.');
        return;
    }

    state.coins -= 50;
    state.hp = state.maxHp;
    state.healBoughtThisPhase = true;
    updatePlayerUI();
    if (state.inBattle) updateBattleUI();
    log('💖 Vida Restaurada com Sucesso! (50 moedas gastas). O poder de cura estará travado até a próxima fase.');
}

function buyHitKillPrompt() {
    if (state.hitkillUsedThisGame) {
        log('⚠️ O Hit Kill Geral já foi utilizado nesta partida!');
        return;
    }
    if (state.coins < 150) {
        log('❌ Moedas insuficientes! O Hit Kill Geral custa 150 moedas.');
        return;
    }

    openChoiceEvent(
        'PODER ANCESTRAL',
        '⚡ HIT KILL GERAL (150 MOEDAS)',
        'ATENÇÃO: Deseja realmente comprar o Hit Kill Geral? Este poder eliminará todos os inimigos da fase atual e avançará para a próxima fase. Pode ser utilizado uma ÚNICA VEZ na partida inteira!',
        'CONFIRMAR COMPRA',
        'CANCELAR',
        () => {
            closeEvent();
            executeHitKill();
        },
        () => {
            closeEvent();
        }
    );
}

function executeHitKill() {
    state.coins -= 150;
    state.hitkillUsedThisGame = true;
    updatePlayerUI();

    log('⚡ PODER DEVASTADOR! O Hit Kill Geral destruiu as forças inimigas da fase!');

    clearFollowers();
    state.skippedEnemies = [];
    state.battleQueue = [];

    if (state.inBattle) {
        state.enemy.hp = 0;
        updateBattleUI();
        setBattleMessage('⚡ HIT KILL! O inimigo foi pulverizado instantaneamente!');
        
        setTimeout(() => {
            state.inBattle = false;
            $('battle-modal').classList.remove('active');
            
            if (state.phase === PHASES.length - 1) {
                victory();
            } else {
                state.pendingNextPhase = true;
                openEvent(
                    'FASE LIMPA COM HIT KILL',
                    'Ameaça Aniquilada!',
                    'O Hit Kill Geral destruiu todos os monstros desta fase!',
                    'AVANÇAR DE FASE'
                );
            }
        }, 1000);
    } else {
        state.position = 31;
        renderPlayerToken();

        const bossTile = document.querySelector('.tile.boss');
        if (bossTile) {
            bossTile.classList.add('boss-defeated');
        }

        if (state.phase === PHASES.length - 1) {
            victory();
        } else {
            state.pendingNextPhase = true;
            openEvent(
                'FASE LIMPA COM HIT KILL',
                'Ameaça Aniquilada!',
                'Você ativou o Hit Kill Geral fora do combate! Todos os monstros da fase foram erradicados.',
                'AVANÇAR DE FASE'
            );
        }
    }
}

function gainXP(amount) {
    state.xp += amount;
    while (state.xp >= 100) {
        state.xp -= 100;
        state.level++;
        state.maxHp += 15;
        state.hp = state.maxHp;
        state.baseAttack += 4;
        state.baseDefense += 2;
        log(`✨ Subiu para o nível ${state.level}! HP restaurado e atributos aumentados.`);
    }
    updatePlayerUI();
}

function resetState() {
    state.phase = 0;
    state.position = 0;
    state.hp = 100;
    state.maxHp = 100;
    state.xp = 0;
    state.level = 1;
    state.coins = 20;
    state.potions = 3;
    state.skillUses = 10;
    state.baseAttack = 16;
    state.baseDefense = 5;
    state.enemiesDefeated = 0;
    state.defending = false;
    state.inBattle = false;
    state.enemy = null;
    state.board = [];
    state.busy = false;
    state.pendingNextPhase = false;
    state.crownBattle = false;
    state.crownEnemyKey = null;
    state.encounterQueue = [];
    state.lastEnemyKey = null;
    clearFollowers();
    state.skippedEnemies = [];
    state.battleQueue = [];
    state.currentEncounterKey = null;
    state.healBoughtThisPhase = false;
    state.hitkillUsedThisGame = false;
    $('end-screen').classList.remove('defeat');
    updatePlayerUI();
}

function clearFollowers() {
    document.querySelectorAll('.enemy-follower').forEach(el => el.remove());
}

function startGame() {
    resetState();
    showScreen('character-screen');
}

function startLoading() {
    showScreen('loading-screen');
    const bar = $('loading-bar');
    const timer = $('loading-timer');
    let progress = 0;
    let seconds = 3;
    clearInterval(state.loadingTimer);
    bar.style.width = '0%';
    timer.textContent = `A preparar a aventura em ${seconds}s...`;

    state.loadingTimer = setInterval(() => {
        progress += 33.4;
        seconds--;
        bar.style.width = `${progress}%`;
        if (seconds > 0) timer.textContent = `A preparar a aventura em ${seconds}s...`;
        if (progress >= 100) {
            clearInterval(state.loadingTimer);
            enterGame();
        }
    }, 1000);
}

function enterGame() {
    showScreen('game-screen');
    $('game-screen').classList.add('active');
    state.phase = 0;
    state.position = 0;
    updatePhaseUI();
    buildBoard();
    updatePlayerUI();
    
    log('🗡️ A aventura começou em Eldoria! Boa sorte.');
    log('⚡ Você possui 10 USOS DE HABILIDADE nesta partida! Abra tesouros para encontrar mais usos.');
}

function updatePhaseUI() {
    const phase = PHASES[state.phase];
    $('phase-name').textContent = phase.name;
    $('phase-number').textContent = `${state.phase + 1} / ${PHASES.length}`;
    $('turn-text').textContent = 'O seu turno';
}

function prepareEnemyRotation() {
    const keys = PHASES[state.phase].enemies;
    state.encounterQueue = [...keys];

    for (let i = state.encounterQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.encounterQueue[i], state.encounterQueue[j]] = [state.encounterQueue[j], state.encounterQueue[i]];
    }

    if (state.encounterQueue.length > 1 && state.encounterQueue[0] === state.lastEnemyKey) {
        [state.encounterQueue[0], state.encounterQueue[1]] = [state.encounterQueue[1], state.encounterQueue[0]];
    }
}

function pickRegularEnemy() {
    if (!state.encounterQueue.length) prepareEnemyRotation();
    const key = state.encounterQueue.shift();
    state.lastEnemyKey = key;
    return key;
}

function buildBoard() {
    const board = $('board');
    board.innerHTML = '';
    state.board = [];
    const total = 32;
    const phase = PHASES[state.phase];

    state.crownEnemyKey = phase.bossKey;
    prepareEnemyRotation();

    const enemyPositions = [
        [5, 14, 23],
        [4, 10, 16, 24],
        [4, 9, 14, 20, 27],
        [3, 8, 13, 18, 24, 28],
        [3, 7, 11, 16, 21, 26, 29],
        [2, 6, 10, 14, 18, 22, 26, 29]
    ];
    const enemyAt = enemyPositions[state.phase] || enemyPositions[enemyPositions.length - 1];
    const treasureAt = [7, 22];
    const healAt = [12, 25];
    const trapAt = [15, 29];
    const bossAt = 31;

    for (let i = 0; i < total; i++) {
        let type = 'normal';
        if (i === 0) type = 'start';
        if (enemyAt.includes(i)) type = 'enemy';
        if (treasureAt.includes(i)) type = 'treasure';
        if (healAt.includes(i)) type = 'heal';
        if (trapAt.includes(i)) type = 'trap';
        if (i === bossAt) type = 'boss';
        state.board.push(type);

        const tile = document.createElement('div');
        tile.className = `tile ${type}`;
        tile.dataset.index = i;

        if (type === 'boss') {
            const crownEnemy = ENEMIES[state.crownEnemyKey];
            tile.innerHTML = `
                <span class="tile-number">${i + 1}</span>
                <img class="boss-enemy-image" src="${crownEnemy.image}" alt="${crownEnemy.name}">
                <span class="boss-enemy-label">${crownEnemy.name}</span>
            `;
            tile.title = `Guardião da Fase: ${crownEnemy.name}`;
        } else {
            tile.innerHTML = `<span class="tile-number">${i + 1}</span><span class="tile-icon">${iconFor(type)}</span>`;
        }
        board.appendChild(tile);
    }
    renderPlayerToken();
}

function iconFor(type) {
    return ({ start: '★', enemy: '☠', treasure: '◆', heal: '✚', trap: '⚠', boss: '♛', normal: '·' })[type] || '·';
}

function renderPlayerToken() {
    document.querySelectorAll('.tile.player').forEach(t => t.classList.remove('player'));
    document.querySelectorAll('.player-token').forEach(t => t.remove());

    for (let i = 0; i < state.position; i++) {
        const visitedTile = document.querySelector(`.tile[data-index="${i}"]`);
        if (visitedTile) visitedTile.classList.add('visited');
    }

    const tile = document.querySelector(`.tile[data-index="${state.position}"]`);
    if (!tile) return;
    tile.classList.add('player');
    const token = document.createElement('div');
    token.className = 'player-token';
    tile.appendChild(token);

    updateFollowersPosition();
}

function updateFollowersPosition() {
    clearFollowers();

    const playerTile = document.querySelector(`.tile[data-index="${state.position}"]`);
    if (!playerTile) return;

    state.skippedEnemies.forEach((key, idx) => {
        let follower = document.createElement('img');
        follower.id = `follower-${idx}`;
        follower.className = 'enemy-follower';
        follower.src = ENEMIES[key].image;
        follower.title = `Perseguidor: ${ENEMIES[key].name}`;
        document.body.appendChild(follower);

        const rect = playerTile.getBoundingClientRect();
        const offsetX = (idx + 1) * 20 - 10;
        const offsetY = -25 - (idx * 10);
        
        follower.style.position = 'fixed';
        follower.style.left = `${rect.left + offsetX}px`;
        follower.style.top = `${rect.top + offsetY}px`;
        follower.style.width = '32px';
        follower.style.height = '32px';
        follower.style.borderRadius = '50%';
        follower.style.border = '2px solid red';
        follower.style.zIndex = '9999';
        follower.style.transition = 'all 0.3s ease';
        follower.style.boxShadow = '0 0 8px rgba(255,0,0,0.8)';
    });
}

function rollDice() {
    if (state.busy || state.inBattle) return;
    state.busy = true;
    const dice = $('dice');
    const button = $('roll-button');
    button.disabled = true;
    dice.classList.add('rolling');

    let ticks = 0;
    const interval = setInterval(() => {
        dice.textContent = Math.floor(Math.random() * 6) + 1;
        ticks++;
        if (ticks >= 7) {
            clearInterval(interval);
            const result = Math.floor(Math.random() * 6) + 1;
            dice.textContent = result;
            dice.classList.remove('rolling');
            movePlayer(result);
        }
    }, 80);
}

function movePlayer(steps) {
    let moved = 0;
    const timer = setInterval(() => {
        if (state.position >= 31) {
            clearInterval(timer);
            finishMove();
            return;
        }
        state.position++;
        moved++;
        renderPlayerToken();
        if (moved >= steps || state.position >= 31) {
            clearInterval(timer);
            setTimeout(finishMove, 250);
        }
    }, 180);
}

function finishMove() {
    const type = state.board[state.position];
    if (state.position >= 31) {
        log(`♛ Chegou à COROA! Prepare-se para enfrentar os inimigos!`);
        startCrownChallenge();
        return;
    }

    $('roll-button').disabled = false;
    state.busy = false;

    if (type === 'enemy') {
        promptEnemyEncounter();
    }
    else if (type === 'treasure') eventTreasure();
    else if (type === 'heal') eventHeal();
    else if (type === 'trap') eventTrapPrompt();
    else log('Avançou com segurança pelo caminho.');
}

function promptEnemyEncounter() {
    state.currentEncounterKey = pickRegularEnemy();
    const enemy = ENEMIES[state.currentEncounterKey];

    openChoiceEvent(
        'INIMIGO NO CAMINHO',
        `Você encontrou um ${enemy.name}!`,
        'Deseja lutar agora ou pular? (ATENÇÃO: Se pular, o monstro irá persegui-lo até o chefe final!)',
        'LUTAR',
        'PULAR',
        () => {
            closeEvent();
            startBattle(false, state.currentEncounterKey);
        },
        () => {
            closeEvent();
            skipEnemy(state.currentEncounterKey);
        }
    );
}

function skipEnemy(key) {
    state.skippedEnemies.push(key);
    log(`⚠️ Você pulou o ${ENEMIES[key].name}! Ele está perseguindo você até a batalha contra o chefe!`);
    updateFollowersPosition();
}

function eventTrapPrompt() {
    openChoiceEvent(
        'ARMADILHA!',
        'Caixa de Espinhos Traiçoeira',
        'Escolha sua ação: Tente pular (Sorte no dado: Sucesso evita todo o dano, Falha sofre 40 de dano) ou Enfrente a armadilha (Sofre entre 1 e 10 de dano).',
        'TENTAR PULAR',
        'ENFRENTAR',
        () => resolveTrapChoice('jump'),
        () => resolveTrapChoice('face')
    );
}

function resolveTrapChoice(choice) {
    closeEvent();
    const roll = Math.floor(Math.random() * 6) + 1;
    let damage = 0;
    let msg = '';

    if (choice === 'jump') {
        if (roll >= 4) {
            damage = 0;
            msg = `🎲 Dado [${roll}]: Sucesso! Você pulou a armadilha sem sofrer nenhum dano!`;
        } else {
            damage = 40;
            msg = `🎲 Dado [${roll}]: Falha! Você tropeçou e sofreu 40 HP de dano pesado!`;
        }
    } else {
        damage = Math.floor(Math.random() * 10) + 1;
        msg = `🛡️ Você enfrentou a armadilha e sofreu apenas ${damage} HP de dano.`;
    }

    state.hp -= damage;
    updatePlayerUI();

    log(msg);

    if (state.hp <= 0) {
        openEvent('ARMADILHA MORTAL', 'Você caiu!', msg, 'FIM DE JOGO');
        setTimeout(defeat, 1000);
        return;
    }

    openEvent('RESULTADO DA ARMADILHA', choice === 'jump' ? 'Tentativa de Pulo' : 'Enfrentou a Armadilha', msg, 'CONTINUAR');
}

function openChoiceEvent(type, title, description, btn1Text, btn2Text, action1, action2) {
    $('event-type').textContent = type;
    $('event-title').textContent = title;
    $('event-description').textContent = description;
    
    let btnContainer = $('modal-actions');
    if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.id = 'modal-actions';
        btnContainer.className = 'modal-actions';
        $('event-modal').querySelector('.event-window').appendChild(btnContainer);
    }
    btnContainer.innerHTML = '';

    const b1 = document.createElement('button');
    b1.className = 'main-button';
    b1.textContent = btn1Text;
    b1.onclick = action1;

    const b2 = document.createElement('button');
    b2.className = 'tutorial-button';
    b2.textContent = btn2Text;
    b2.onclick = action2;

    btnContainer.appendChild(b1);
    btnContainer.appendChild(b2);

    $('event-modal').classList.add('active');
}

function openEvent(type, title, description, buttonText) {
    $('event-type').textContent = type;
    $('event-title').textContent = title;
    $('event-description').textContent = description;
    
    let btnContainer = $('modal-actions');
    if (!btnContainer) {
        btnContainer = document.createElement('div');
        btnContainer.id = 'modal-actions';
        btnContainer.className = 'modal-actions';
        $('event-modal').querySelector('.event-window').appendChild(btnContainer);
    }
    btnContainer.innerHTML = '';
    
    const b = document.createElement('button');
    b.id = 'event-button';
    b.className = 'main-button';
    b.textContent = buttonText;
    b.onclick = () => {
        if (state.pendingNextPhase) {
            state.pendingNextPhase = false;
            closeEvent();
            startNextPhaseLoading();
            return;
        }
        closeEvent();
    };
    
    btnContainer.appendChild(b);
    $('event-modal').classList.add('active');
}

function closeEvent() {
    $('event-modal').classList.remove('active');
}

function eventTreasure() {
    const coinsGained = Math.floor(Math.random() * 15) + 15;
    const gotPotion = Math.random() < 0.6;
    
    const skillUsesGained = Math.floor(Math.random() * 3) + 1;
    const xpGained = Math.floor(Math.random() * 131) + 20;

    state.coins += coinsGained;
    state.skillUses += skillUsesGained;
    if (gotPotion) state.potions += 1;
    
    gainXP(xpGained);

    let desc = `Encontrou ${coinsGained} moedas de ouro, +${skillUsesGained} usos de habilidade e +${xpGained} XP!`;
    if (gotPotion) {
        desc += ` Ganhou também 1 Poção de Cura!`;
    }

    log(`🎁 Tesouro aberto: +${coinsGained} moedas, +${skillUsesGained} usos de habilidade e +${xpGained} XP.`);
    openEvent('TESOURO', 'Baú Recheado', desc, 'CONTINUAR');
}

function eventHeal() {
    const healAmount = 30;
    state.hp = Math.min(state.maxHp, state.hp + healAmount);
    updatePlayerUI();
    openEvent('CURA', 'Fonte Sagrada', `A água purificada restaurou ${healAmount} de HP!`, 'CONTINUAR');
}

/* =========================================
   SISTEMA DE DESAFIO DO CHEFE E INIMIGOS PULADOS
========================================= */

function startCrownChallenge() {
    state.battleQueue = [...state.skippedEnemies, state.crownEnemyKey];
    nextInBattleQueue();
}

function nextInBattleQueue() {
    if (state.battleQueue.length === 0) {
        winCrownFinal();
        return;
    }

    const nextEnemyKey = state.battleQueue.shift();
    const isBoss = (state.battleQueue.length === 0);

    startBattle(isBoss, nextEnemyKey, true, !isBoss);
}

function startBattle(isCrown = false, specificKey = null, isQueueBattle = false, isHalfHp = false) {
    const phase = PHASES[state.phase];
    const key = specificKey || (isCrown ? state.crownEnemyKey : pickRegularEnemy());
    const base = ENEMIES[key];

    let multiplier = phase.multiplier * (isCrown ? 1.30 : 1);
    
    let calculatedHp = Math.round(base.hp * multiplier);
    
    if (isHalfHp) {
        calculatedHp = Math.max(1, Math.round(calculatedHp * 0.5));
    }

    const crownName = isCrown && !phase.boss ? `Guardião: ${base.name}` : base.name;

    state.busy = false;
    state.inBattle = true;
    state.defending = false;
    state.crownBattle = isCrown;

    state.enemy = {
        key: key,
        name: crownName,
        maxHp: calculatedHp,
        hp: calculatedHp,
        attack: Math.round(base.attack * multiplier),
        image: base.image,
        boss: !!phase.boss,
        crown: isCrown,
        isQueueBattle: isQueueBattle
    };

    $('enemy-name').textContent = state.enemy.name;
    
    if (isQueueBattle) {
        const totalEnemiesLeft = state.battleQueue.length + 1;
        $('enemy-type').textContent = isCrown 
            ? `CHEFE FINAL (${totalEnemiesLeft} RESTANTE)` 
            : `PERSEGUIDOR [VIDA 50%] (${totalEnemiesLeft} RESTANTES)`;
    } else {
        $('enemy-type').textContent = `INIMIGO • FASE ${state.phase + 1}`;
    }

    $('battle-enemy-name').textContent = state.enemy.name;
    $('enemy-img-display').src = state.enemy.image;
    
    let battleMsg = `O combate contra ${state.enemy.name} começou!`;
    if (isQueueBattle && !isCrown) {
        battleMsg = `⚠️ O perseguidor ${state.enemy.name} apareceu enfraquecido (50% de HP)! Derrote-o!`;
    } else if (isQueueBattle && isCrown) {
        battleMsg = `♛ O Guardião Final ${state.enemy.name} entrou no combate!`;
    }

    $('battle-log').textContent = battleMsg;
    
    $('battle-modal').classList.add('active');
    updateBattleUI();
}

function updateBattleUI() {
    const e = state.enemy;
    if (!e) return;
    
    const playerHpPct = Math.max(0, (state.hp / state.maxHp) * 100);
    $('battle-player-hp').style.width = `${playerHpPct}%`;
    $('battle-player-hp-text').textContent = `${Math.max(0, state.hp)} / ${state.maxHp}`;
    
    const enemyHpPct = Math.max(0, (e.hp / e.maxHp) * 100);
    $('battle-enemy-hp').style.width = `${enemyHpPct}%`;
    $('battle-enemy-hp-text').textContent = `${Math.max(0, e.hp)} / ${e.maxHp}`;
    
    $('battle-player-name').textContent = 'Gunslinger';
}

function setBattleMessage(text) {
    $('battle-log').textContent = text;
}

function playerAttack() {
    if (!canBattleAction()) return;
    
    const isCrit = Math.random() < 0.15;
    let damage = Math.max(5, state.baseAttack + Math.floor(Math.random() * 6) - 2);
    if (isCrit) damage = Math.round(damage * 1.5);

    state.enemy.hp -= damage;
    const msg = isCrit 
        ? `💥 ATAQUE CRÍTICO! Causou ${damage} de dano a ${state.enemy.name}!` 
        : `Atacou ${state.enemy.name} causando ${damage} de dano.`;
    
    setBattleMessage(msg);
    updateBattleUI();
    afterPlayerAction();
}

function defend() {
    if (!canBattleAction()) return;
    state.defending = true;
    setBattleMessage('Assumiu uma postura defensiva! Dano reduzido no próximo turno.');
    enemyTurn();
}

function useSkill() {
    if (!canBattleAction()) return;

    if (state.skillUses <= 0) {
        setBattleMessage('Sem usos de habilidade restantes! Abra tesouros para encontrar mais.');
        return;
    }

    state.skillUses--;
    updatePlayerUI();
    
    const sk = SKILLS[state.skillKey];
    const isCrit = Math.random() < sk.critical;
    let damage = Math.max(8, state.baseAttack + sk.attackBonus + Math.floor(Math.random() * 5));
    if (isCrit) damage = Math.round(damage * 1.6);

    state.enemy.hp -= damage;
    
    if (sk.heal > 0) {
        state.hp = Math.min(state.maxHp, state.hp + sk.heal);
        updatePlayerUI();
    }

    const msg = isCrit
        ? `✨ HABILIDADE CRÍTICA (${sk.name})! Causou ${damage} de dano! (${state.skillUses} usos restantes)`
        : `Usou ${sk.name} causando ${damage} de dano! (${state.skillUses} usos restantes)`;
    
    setBattleMessage(msg);
    updateBattleUI();
    afterPlayerAction();
}

function usePotion() {
    if (!canBattleAction()) return;
    if (state.potions <= 0) {
        setBattleMessage('Não tem poções de cura disponíveis!');
        return;
    }

    state.potions--;
    const healVal = 45;
    state.hp = Math.min(state.maxHp, state.hp + healVal);
    updatePlayerUI();
    updateBattleUI();
    
    setBattleMessage(`Bebeu uma poção e recuperou ${healVal} de HP!`);
    enemyTurn();
}

function canBattleAction() {
    return state.inBattle && state.enemy && state.enemy.hp > 0 && !state.busy;
}

function afterPlayerAction() {
    if (state.enemy.hp <= 0) {
        winBattle();
        return;
    }
    enemyTurn();
}

function enemyTurn() {
    state.busy = true;
    setTimeout(() => {
        if (!state.inBattle || !state.enemy) {
            state.busy = false;
            return;
        }

        let rawDamage = state.enemy.attack + Math.floor(Math.random() * 5) - 2;
        let finalDamage = Math.max(3, rawDamage - state.baseDefense);
        
        if (state.defending) {
            finalDamage = Math.floor(finalDamage / 2);
            state.defending = false;
        }

        state.hp -= finalDamage;
        updatePlayerUI();
        updateBattleUI();

        if (state.hp <= 0) {
            defeat();
            return;
        }

        setBattleMessage(`${state.enemy.name} atacou e causou ${finalDamage} de dano!`);
        state.busy = false;
    }, 600);
}

function winBattle() {
    state.inBattle = false;
    state.enemiesDefeated++;
    const defeated = state.enemy;
    const rewardCoins = defeated.crown ? 40 : 15;
    const xpGained = defeated.crown ? 60 : 35;
    
    state.coins += rewardCoins;
    gainXP(xpGained);

    log(`Derrotou ${defeated.name}! (+${rewardCoins} moedas, +${xpGained} XP)`);

    const idx = state.skippedEnemies.indexOf(defeated.key);
    if (idx !== -1) {
        state.skippedEnemies.splice(idx, 1);
        updateFollowersPosition();
    }

    if (defeated.isQueueBattle) {
        if (state.battleQueue.length > 0) {
            setBattleMessage(`Você derrotou ${defeated.name}! O próximo monstro se aproxima...`);
            setTimeout(() => {
                nextInBattleQueue();
            }, 1200);
            return;
        } else {
            winCrownFinal();
            return;
        }
    }

    state.busy = true;
    $('roll-button').disabled = true;

    $('battle-modal').classList.remove('active');

    checkPromptSkippedEnemies(defeated, rewardCoins, xpGained);
}

function checkPromptSkippedEnemies(defeated, rewardCoins, xpGained) {
    if (state.skippedEnemies.length > 0) {
        const skippedKey = state.skippedEnemies[0];
        const skippedEnemyObj = ENEMIES[skippedKey];

        openChoiceEvent(
            'INIMIGO PERSEGUIDOR',
            `Monstro Anterior Pulado!`,
            `Você derrotou o ${defeated.name}. Deseja lutar agora com o ${skippedEnemyObj.name} que você havia pulado ou continuar pulando ele?`,
            'LUTAR AGORA',
            'CONTINUAR PULANDO',
            () => {
                closeEvent();
                startBattle(false, skippedKey);
            },
            () => {
                closeEvent();
                state.busy = false;
                $('roll-button').disabled = false;
                log(`Você escolheu continuar pulando o ${skippedEnemyObj.name}.`);
            }
        );
    } else {
        state.pendingNextPhase = false;
        state.busy = false;
        $('roll-button').disabled = false;
        openEvent(
            'INIMIGO DERROTADO',
            `${defeated.name} foi vencido!`,
            `Ganhou ${rewardCoins} moedas e ${xpGained} XP. Continue pelo tabuleiro até à coroa.`,
            'CONTINUAR'
        );
    }
}

function winCrownFinal() {
    state.busy = true;
    $('roll-button').disabled = true;

    clearFollowers();
    state.skippedEnemies = [];

    const bossTile = document.querySelector('.tile.boss');
    if (bossTile) {
        bossTile.classList.add('boss-defeated');
    }

    $('battle-modal').classList.remove('active');

    if (state.phase === PHASES.length - 1) {
        setTimeout(victory, 1500);
        return;
    }

    state.pendingNextPhase = true;
    setTimeout(() => {
        openEvent(
            'GUARDIÃO E PERSEGUIDORES DERROTADOS',
            `Vitória Absoluta!`,
            `Você derrotou todos os perseguidores e superou o Guardião da Fase ${state.phase + 1}!`,
            'AVANÇAR DE FASE'
        );
    }, 1500);
}

function defeat() {
    state.busy = false;
    state.inBattle = false;
    clearFollowers();
    $('battle-modal').classList.remove('active');$('end-screen').classList.add('defeat', 'active');
    $('end-symbol').textContent = '☠';$('end-subtitle').textContent = 'DERROTA';
    $('end-title').textContent = 'CAIU EM COMBATE';$('end-message').textContent = 'As forças das trevas de Eldoria superaram o seu herói. Fortaleça-se e tente novamente!';
    fillFinalStats();
}

function victory() {
    state.busy = false;
    state.inBattle = false;
    clearFollowers();
    $('battle-modal').classList.remove('active');
    $('end-screen').classList.remove('defeat');$('end-screen').classList.add('active');
    $('end-symbol').textContent = '✦';$('end-subtitle').textContent = 'GLÓRIA ETERNA';
    $('end-title').textContent = 'VITÓRIA ABSOLUTA';
    $('end-message').textContent = 'Derrotou todos os guardiões e libertou Eldoria da escuridão!';
    fillFinalStats();
}

function fillFinalStats() {
    $('final-level').textContent = state.level;
    $('final-enemies').textContent = state.enemiesDefeated;
    $('final-coins').textContent = state.coins;
}

function chooseSkill(card) {
    document.querySelectorAll('.character-card').forEach(c => c.style.borderColor = '#343a41');
    card.style.borderColor = 'var(--gold)';
    state.skillKey = card.dataset.skill;
    setTimeout(startLoading, 300);
}

function openTutorial() {
    $('tutorial-modal').classList.add('active');
}

function closeTutorial() {
    $('tutorial-modal').classList.remove('active');
}

function startNextPhaseLoading() {
    state.pendingNextPhase = false;
    state.phase++;
    
    state.healBoughtThisPhase = false;

    const overlay = $('phase-loading');
    const fill = $('phase-loading-fill');
    const percent = $('phase-loading-percent');
    const title = $('phase-loading-title');
    const message = $('phase-loading-text');

    overlay.style.display = 'flex';
    overlay.style.pointerEvents = 'auto';
    overlay.classList.add('active');
    overlay.setAttribute('aria-hidden', 'false');
    fill.style.width = '0%';
    percent.textContent = '0%';
    title.textContent = `A preparar a Fase ${state.phase + 1}...`;
    message.textContent = `${PHASES[state.phase].name} aguarda-o. Guardião: ${ENEMIES[PHASES[state.phase].bossKey].name}!`;

    let progress = 0;
    clearInterval(state.loadingTimer);
    state.loadingTimer = setInterval(() => {
        progress += 5;
        if (progress > 100) progress = 100;
        fill.style.width = `${progress}%`;
        percent.textContent = `${progress}%`;

        if (progress >= 100) {
            clearInterval(state.loadingTimer);
            state.loadingTimer = null;
            state.position = 0;
            state.encounterQueue = [];
            state.lastEnemyKey = null;

            updatePhaseUI();
            buildBoard();
            updatePlayerUI();
            log(`Entrou na Fase ${state.phase + 1}: ${PHASES[state.phase].name}. A loja de cura foi redefinida!`);
            $('turn-text').textContent = `Fase ${state.phase + 1}: lance o dado`;

            overlay.classList.remove('active');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.style.display = 'none';
            overlay.style.pointerEvents = 'none';

            state.busy = false;
            $('roll-button').disabled = false;
        }
    }, 30);
}

function init() {
    $('start-button').addEventListener('click', startGame);
    $('roll-button').addEventListener('click', rollDice);$('restart-button').addEventListener('click', () => {
        clearInterval(state.loadingTimer);
        resetState();
        showScreen('start-screen');
    });
    $('play-again-button').addEventListener('click', () => {$('end-screen').classList.remove('active');
        resetState();
        showScreen('start-screen');
    });
    $('attack-button').addEventListener('click', playerAttack);$('defend-button').addEventListener('click', defend);
    $('skill-button').addEventListener('click', useSkill);$('potion-button').addEventListener('click', usePotion);

    // Botoes da Loja
    $('buy-heal-button').addEventListener('click', buyInstantHeal);$('buy-hitkill-button').addEventListener('click', buyHitKillPrompt);

    document.querySelectorAll('.character-card').forEach(card => {
        card.addEventListener('click', () => chooseSkill(card));
    });

    $('tutorial-button').addEventListener('click', openTutorial);$('tutorial-close').addEventListener('click', closeTutorial);
    $('tutorial-ok').addEventListener('click', closeTutorial);$('tutorial-modal').addEventListener('click', e => {
        if (e.target === $('tutorial-modal')) closeTutorial();
    });

    updatePlayerUI();
}

document.addEventListener('DOMContentLoaded', init);