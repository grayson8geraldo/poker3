// ============================================================
// APP.JS v2 - GTO Poker Advisor UI Controller
// Beginner-friendly with auto pot, visual table, street tracking
// ============================================================
(function() {
    'use strict';

    // ---- STATE ----
    const state = {
        myCards: [null, null],
        boardCards: [null, null, null, null, null],
        position: 'BTN',
        playerCount: 8,
        situation: 'none',  // none | limp | raise | 3bet | allin
        opponentAction: 'first', // first | check | bet
        opponentBet: 0,
        handNumber: 1,
        blindSize: 100,
        stackSize: 10000,
        anteSize: 0,
        playersRemaining: 50,
        paidPlaces: 8,
        activeSlot: null,
        usedCards: new Set(),
    };

    // ---- POSITIONS ----
    const allPositions = ['UTG','UTG+1','MP','MP+1','HJ','CO','BTN','SB','BB'];

    function getActivePositions() {
        const n = state.playerCount;
        return allPositions.slice(allPositions.length - n);
    }

    // ---- VISUAL TABLE ----
    // Layout seats in 3 zones: top row, left+right sides, bottom row
    // For N seats we distribute: top = ~40%, sides = 1 each, bottom = rest
    function renderTable() {
        const topC = document.getElementById('topSeats');
        const leftC = document.getElementById('leftSeats');
        const rightC = document.getElementById('rightSeats');
        const bottomC = document.getElementById('bottomSeats');
        topC.innerHTML = '';
        leftC.innerHTML = '';
        rightC.innerHTML = '';
        bottomC.innerHTML = '';

        const positions = getActivePositions();
        const n = positions.length;

        // Distribute seats around the "table":
        // Bottom: BB, SB (last 2)  |  Left: BTN  |  Top: middle positions  |  Right: early positions
        // We'll split smartly based on count
        let bottomSlots, leftSlots, topSlots, rightSlots;

        if (n <= 3) {
            bottomSlots = positions.slice(-1);          // BB
            topSlots = positions.slice(0, n - 1);       // rest on top
            leftSlots = [];
            rightSlots = [];
        } else if (n <= 5) {
            bottomSlots = positions.slice(-2);          // SB, BB
            leftSlots = [positions[n - 3]];             // BTN
            topSlots = positions.slice(0, n - 3);       // rest
            rightSlots = [];
        } else {
            bottomSlots = positions.slice(-2);          // SB, BB
            leftSlots = [positions[n - 3]];             // BTN
            rightSlots = [positions[0]];                // UTG (earliest)
            topSlots = positions.slice(1, n - 3);       // middle positions
        }

        function createSeat(pos) {
            const posInfo = GTO.POSITION_INFO[pos];
            const seat = document.createElement('div');
            seat.className = 'seat' + (pos === state.position ? ' active' : '');

            const chip = document.createElement('div');
            chip.className = 'seat-chip';
            chip.textContent = posInfo.short;

            const label = document.createElement('div');
            label.className = 'seat-label';
            label.textContent = posInfo.name;

            seat.appendChild(chip);
            seat.appendChild(label);
            seat.addEventListener('click', () => {
                state.position = pos;
                renderTable();
                updatePositionHint();
            });
            return seat;
        }

        topSlots.forEach(p => topC.appendChild(createSeat(p)));
        leftSlots.forEach(p => leftC.appendChild(createSeat(p)));
        rightSlots.forEach(p => rightC.appendChild(createSeat(p)));
        bottomSlots.forEach(p => bottomC.appendChild(createSeat(p)));

        updatePositionHint();
    }

    function updatePositionHint() {
        const hint = document.getElementById('positionHint');
        const posInfo = GTO.POSITION_INFO[state.position];
        hint.textContent = posInfo ? posInfo.desc : '';
        const info = document.getElementById('tableInfo');
        info.textContent = `Ты: ${state.position}`;
    }

    // ---- STREET TRACKING ----
    function getCurrentStreet() {
        const boardCount = state.boardCards.filter(c => c !== null).length;
        if (boardCount >= 5) return 'river';
        if (boardCount >= 4) return 'turn';
        if (boardCount >= 3) return 'flop';
        return 'preflop';
    }

    function updateStreetProgress() {
        const current = getCurrentStreet();
        const streets = ['preflop', 'flop', 'turn', 'river'];
        const currentIdx = streets.indexOf(current);

        document.querySelectorAll('.street-step').forEach((el, i) => {
            el.classList.remove('active', 'completed');
            if (i === currentIdx) el.classList.add('active');
            else if (i < currentIdx) el.classList.add('completed');
        });

        // Show/hide postflop opponent action
        updatePostflopUI();
    }

    // ---- TOURNAMENT INFO ----
    function readTourneyInputs() {
        state.stackSize = parseInt(document.getElementById('stackSize').value) || 10000;
        state.blindSize = parseInt(document.getElementById('blindSize').value) || 100;
        state.anteSize = parseInt(document.getElementById('anteSize').value) || 0;
        state.playersRemaining = parseInt(document.getElementById('playersRemaining').value) || 50;
        state.paidPlaces = parseInt(document.getElementById('paidPlaces').value) || 8;
    }

    function updateTourneyDisplay() {
        readTourneyInputs();
        const m = GTO.calculateM(state.stackSize, state.blindSize, state.playerCount, state.anteSize);
        const mZone = GTO.getMZone(m);
        const bbInStack = state.blindSize > 0 ? (state.stackSize / state.blindSize) : 0;
        const totalPlayers = Math.max(state.playersRemaining, state.playerCount);
        const phase = GTO.detectPhase(state.playersRemaining, totalPlayers, state.paidPlaces);
        const phaseInfo = GTO.PHASE_INFO[phase] || GTO.PHASE_INFO['normal'];

        const mEl = document.getElementById('mzoneValue');
        mEl.textContent = m > 100 ? '99+' : m.toFixed(1);
        mEl.className = 'mzone-value ' + mZone.zone;

        document.getElementById('phaseValue').innerHTML = `<span style="color:${phaseInfo.color}">${phaseInfo.emoji} ${phaseInfo.name}</span>`;
        document.getElementById('stackBB').textContent = bbInStack.toFixed(0) + ' BB';
    }

    // ---- CARD PICKER ----
    const SUITS_DISPLAY = [
        { key: 'h', name: 'hearts', symbol: '♥', label: 'Червы', color: 'suit-h' },
        { key: 'd', name: 'diamonds', symbol: '♦', label: 'Бубны', color: 'suit-d' },
        { key: 'c', name: 'clubs', symbol: '♣', label: 'Трефы', color: 'suit-c' },
        { key: 's', name: 'spades', symbol: '♠', label: 'Пики', color: 'suit-s' }
    ];

    function buildCardPicker() {
        const container = document.getElementById('pickerSuits');
        container.innerHTML = '';

        SUITS_DISPLAY.forEach(suit => {
            const section = document.createElement('div');
            section.className = 'picker-suit-section';

            const label = document.createElement('div');
            label.className = 'picker-suit-label ' + suit.name;
            label.innerHTML = `${suit.symbol} <span class="suit-name">${suit.label}</span>`;
            section.appendChild(label);

            const cards = document.createElement('div');
            cards.className = 'picker-cards';

            GTO.RANKS.forEach(rank => {
                const card = document.createElement('div');
                const cardId = rank + suit.key;
                card.className = 'picker-card ' + suit.name;
                if (state.usedCards.has(cardId)) card.classList.add('used');
                card.textContent = rank === 'T' ? '10' : rank;
                card.addEventListener('click', () => selectCard(cardId));
                cards.appendChild(card);
            });

            section.appendChild(cards);
            container.appendChild(section);
        });
    }

    function openCardPicker(slotId) {
        state.activeSlot = slotId;
        const title = document.getElementById('pickerTitle');
        const slotNames = {
            myCard1: 'Выбери 1-ю карту', myCard2: 'Выбери 2-ю карту',
            flop1: 'Флоп: 1-я карта', flop2: 'Флоп: 2-я карта', flop3: 'Флоп: 3-я карта',
            turn: 'Тёрн', river: 'Ривер'
        };
        title.textContent = slotNames[slotId] || 'Выбери карту';
        buildCardPicker();
        document.getElementById('cardPickerOverlay').classList.add('show');
    }

    function closeCardPicker() {
        document.getElementById('cardPickerOverlay').classList.remove('show');
        state.activeSlot = null;
    }

    function getSlotIndex(slot) {
        const map = { myCard1: ['myCards', 0], myCard2: ['myCards', 1], flop1: ['boardCards', 0], flop2: ['boardCards', 1], flop3: ['boardCards', 2], turn: ['boardCards', 3], river: ['boardCards', 4] };
        return map[slot];
    }

    function selectCard(cardId) {
        if (state.usedCards.has(cardId)) return;
        const slot = state.activeSlot;
        if (!slot) return;

        const prevStreet = getCurrentStreet();

        const [arr, idx] = getSlotIndex(slot);
        const oldCard = state[arr][idx];
        if (oldCard) state.usedCards.delete(oldCard);

        state.usedCards.add(cardId);
        state[arr][idx] = cardId;

        renderCardSlots();
        updateStreetProgress();

        // Reset opponent action when entering a new street
        const newStreet = getCurrentStreet();
        if (newStreet !== prevStreet) {
            resetOpponentAction();
        }

        updatePot();
        closeCardPicker();
        autoOpenNext(slot);
        autoAnalyze();
    }

    function clearCardSlot(slotId) {
        const [arr, idx] = getSlotIndex(slotId);
        const oldCard = state[arr][idx];
        if (oldCard) state.usedCards.delete(oldCard);
        state[arr][idx] = null;
        renderCardSlots();
        updateStreetProgress();
    }

    function autoOpenNext(currentSlot) {
        // Only auto-open the second hole card after the first
        // Do NOT auto-open flop — user needs preflop advice first
        if (currentSlot === 'myCard1' && !state.myCards[1]) {
            setTimeout(() => openCardPicker('myCard2'), 180);
            return;
        }
        // After flop cards, auto-open next flop card
        if (currentSlot === 'flop1' && !state.boardCards[1]) {
            setTimeout(() => openCardPicker('flop2'), 180);
            return;
        }
        if (currentSlot === 'flop2' && !state.boardCards[2]) {
            setTimeout(() => openCardPicker('flop3'), 180);
            return;
        }
        // Don't auto-open turn/river — let user decide when
    }

    function renderCardSlots() {
        const allSlots = ['myCard1', 'myCard2', 'flop1', 'flop2', 'flop3', 'turn', 'river'];
        allSlots.forEach(slotId => {
            const [arr, idx] = getSlotIndex(slotId);
            const card = state[arr][idx];
            const el = document.getElementById(slotId);

            if (card) {
                const rank = card[0];
                const suit = card[1];
                const suitInfo = SUITS_DISPLAY.find(s => s.key === suit);
                const displayRank = rank === 'T' ? '10' : rank;
                el.innerHTML = `<span class="card-rank">${displayRank}</span><span class="card-suit">${suitInfo.symbol}</span>`;
                el.className = 'card-slot filled ' + suitInfo.color;
                if (['flop1','flop2','flop3','turn','river'].includes(slotId)) el.classList.add('board-slot');
                if (slotId === 'turn') el.classList.add('turn-slot');
                if (slotId === 'river') el.classList.add('river-slot');
            } else {
                el.innerHTML = '<span class="card-placeholder">+</span>';
                el.className = 'card-slot';
                if (['flop1','flop2','flop3','turn','river'].includes(slotId)) el.classList.add('board-slot');
                if (slotId === 'turn') el.classList.add('turn-slot');
                if (slotId === 'river') el.classList.add('river-slot');
            }
        });
    }

    // ---- SITUATION (replaces old action log) ----
    // Convert situation to actions array for engine compatibility
    function situationToActions() {
        switch (state.situation) {
            case 'limp':  return ['limp'];
            case 'raise': return ['raise'];
            case '3bet':  return ['raise', '3bet'];
            case 'allin': return ['allin'];
            default:      return [];
        }
    }

    // Were we the preflop aggressor? (for c-bet logic)
    // none/limp = we opened/raised → aggressor
    // raise/3bet/allin = we defended → not aggressor
    function wasPreflopAggressor() {
        return state.situation === 'none' || state.situation === 'limp';
    }

    function setSituation(sit) {
        state.situation = sit;
        document.querySelectorAll('.btn-situation').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.situation === sit);
        });
        updatePot();
        autoAnalyze();
    }

    // ---- OPPONENT POSTFLOP ACTION ----
    function setOpponentAction(action) {
        state.opponentAction = action;
        document.getElementById('oppFirst').classList.toggle('active', action === 'first');
        document.getElementById('oppCheck').classList.toggle('active', action === 'check');
        document.getElementById('oppBet').classList.toggle('active', action === 'bet');
        document.getElementById('oppBetBlock').style.display = action === 'bet' ? 'block' : 'none';
        if (action === 'bet') {
            state.opponentBet = parseInt(document.getElementById('oppBetSize').value) || 0;
            updateBetWarning();
            updateQuickBetButtons();
        } else {
            state.opponentBet = 0;
            document.getElementById('oppBetWarning').style.display = 'none';
        }
        updatePot();
        autoAnalyze();
    }

    function updateOpponentBet() {
        state.opponentBet = parseInt(document.getElementById('oppBetSize').value) || 0;
        updateBetWarning();
        updatePot();
        autoAnalyze();
    }

    function updateBetWarning() {
        const warning = document.getElementById('oppBetWarning');
        if (state.opponentAction === 'bet' && state.opponentBet <= 0) {
            warning.style.display = 'block';
        } else {
            warning.style.display = 'none';
        }
    }

    function updateQuickBetButtons() {
        // Calculate current pot to show quick bet options
        const actions = situationToActions();
        const est = GTO.estimatePot(actions, state.blindSize, state.playerCount, state.anteSize);
        const pot = est.pot;
        document.querySelectorAll('.btn-bet-quick').forEach(btn => {
            const pct = parseInt(btn.dataset.pct);
            const amount = Math.round(pot * pct / 100);
            btn.title = amount + ' фишек';
        });
    }

    function handleQuickBet(pct) {
        const actions = situationToActions();
        const est = GTO.estimatePot(actions, state.blindSize, state.playerCount, state.anteSize);
        const amount = Math.round(est.pot * pct / 100);
        document.getElementById('oppBetSize').value = amount;
        updateOpponentBet();
    }

    function updatePostflopUI() {
        const street = getCurrentStreet();
        const section = document.getElementById('opponentActionSection');
        if (street === 'preflop') {
            section.style.display = 'none';
        } else {
            section.style.display = 'block';
            const streetNames = { flop: 'флопе', turn: 'тёрне', river: 'ривере' };
            document.getElementById('opponentActionLabel').textContent =
                `Ситуация на ${streetNames[street] || street}:`;
        }
    }

    function resetOpponentAction() {
        state.opponentAction = 'first';
        state.opponentBet = 0;
        document.getElementById('oppFirst').classList.add('active');
        document.getElementById('oppCheck').classList.remove('active');
        document.getElementById('oppBet').classList.remove('active');
        document.getElementById('oppBetBlock').style.display = 'none';
        document.getElementById('oppBetWarning').style.display = 'none';
        const betInput = document.getElementById('oppBetSize');
        if (betInput) betInput.value = '';
    }

    // ---- POT CALCULATION ----
    function updatePot() {
        readTourneyInputs();
        const actions = situationToActions();
        const est = GTO.estimatePot(actions, state.blindSize, state.playerCount, state.anteSize);
        // Add opponent bet to pot on postflop
        const totalPot = est.pot + state.opponentBet;
        document.getElementById('potValue').textContent = totalPot;
        updateTourneyDisplay();
    }

    // ---- NEW HAND ----
    function newHand() {
        const active = getActivePositions();
        const currentIdx = active.indexOf(state.position);
        const nextIdx = (currentIdx - 1 + active.length) % active.length;
        state.position = active[nextIdx];

        state.myCards = [null, null];
        state.boardCards = [null, null, null, null, null];
        state.situation = 'none';
        state.opponentAction = 'first';
        state.opponentBet = 0;
        state.usedCards.clear();
        state.handNumber++;

        document.getElementById('handNumber').textContent = state.handNumber;
        document.getElementById('cardInput').value = '';
        document.querySelectorAll('.btn-situation').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.situation === 'none');
        });
        resetOpponentAction();
        renderTable();
        renderCardSlots();
        updateStreetProgress();
        updatePot();

        document.getElementById('advicePanel').innerHTML = `
            <div class="advice-empty">
                <div class="advice-empty-icon">🃏</div>
                <div>Выбери свои карты — совет появится автоматически</div>
                <div class="advice-empty-tip">Позиция сдвинулась → ты теперь <strong>${state.position}</strong></div>
            </div>`;
    }

    // ---- ANALYSIS ----
    function runAnalysis() {
        const panel = document.getElementById('advicePanel');

        if (!state.myCards[0] || !state.myCards[1]) {
            panel.innerHTML = `<div class="advice-empty">
                <div class="advice-empty-icon">👆</div>
                <div>Сначала выбери свои 2 карты!</div>
                <div class="advice-empty-tip">Нажми на слоты «+» слева вверху</div>
            </div>`;
            return;
        }

        readTourneyInputs();
        const actions = situationToActions();
        const potEst = GTO.estimatePot(actions, state.blindSize, state.playerCount, state.anteSize);

        const hand = GTO.classifyHand(state.myCards[0], state.myCards[1]);
        const score = GTO.handStrengthScore(hand);
        const category = GTO.getHandCategory(score);
        const nickname = GTO.getHandNickname(hand.name);
        const handDesc = GTO.describeHandForBeginner(hand);

        const street = getCurrentStreet();
        let html = '';

        if (street === 'preflop') {
            // Use tournament engine
            const tournamentInfo = {
                stack: state.stackSize,
                blindSize: state.blindSize,
                ante: state.anteSize,
                playersRemaining: state.playersRemaining,
                totalPlayers: Math.max(state.playersRemaining, state.playerCount),
                paidPlaces: state.paidPlaces
            };
            const decision = GTO.tournamentPreflopDecision(hand, state.position, actions, state.playerCount, tournamentInfo);

            html += renderHero(decision.action, decision.confidence, decision.tips[0] || '');

            html += '<div class="advice-body">';

            // M-Zone & Phase card
            if (decision.mZone) {
                html += `<div class="advice-card">
                    <div class="advice-card-title">${decision.mZone.emoji} Турнирная ситуация</div>
                    <div class="advice-row"><span class="label">M-ratio</span><span class="value" style="color:${decision.mZone.color}">${decision.m.toFixed(1)} — ${decision.mZone.name} зона</span></div>
                    <div class="advice-row"><span class="label">Фаза</span><span class="value" style="color:${decision.phaseInfo.color}">${decision.phaseInfo.emoji} ${decision.phaseInfo.name}</span></div>
                    <div class="advice-row"><span class="label">Стек</span><span class="value">${state.stackSize} (${(state.stackSize / state.blindSize).toFixed(0)} BB)</span></div>
                    ${decision.isPushFold ? '<div class="pushfold-badge">РЕЖИМ PUSH / FOLD</div>' : ''}
                    <p style="font-size:12px;color:var(--text2);margin-top:6px">${decision.mZone.desc}</p>
                </div>`;
            }

            // Beginner tip
            html += `<div class="beginner-tip">
                <div class="beginner-tip-header">💡 Подсказка</div>
                ${decision.tips.map(t => `<p>${t}</p>`).join('')}
            </div>`;

            // Phase tip
            if (decision.phaseInfo && decision.phase !== 'normal') {
                html += `<div class="beginner-tip" style="border-left-color:${decision.phaseInfo.color}">
                    <div class="beginner-tip-header" style="color:${decision.phaseInfo.color}">${decision.phaseInfo.emoji} ${decision.phaseInfo.name}</div>
                    <p>${decision.phaseInfo.tip}</p>
                </div>`;
            }

            // Hand info
            html += `<div class="advice-card">
                <div class="advice-card-title">🃏 Твоя рука</div>
                <div class="advice-row"><span class="label">Комбинация</span><span class="value">${hand.name}${nickname ? ' — ' + nickname : ''}</span></div>
                <div class="advice-row"><span class="label">Тип</span><span class="value">${hand.pair ? 'Карманная пара' : (hand.suited ? 'Одномастные' : 'Разномастные')}${hand.connected ? ' + подряд' : ''}</span></div>
                <div class="advice-row"><span class="label">Категория</span><span class="value" style="color:${category.color}">${category.emoji} ${category.name}</span></div>
                <p style="font-size:12px;color:var(--text2);margin-top:6px">${handDesc}</p>
                ${renderStrengthMeter(score)}
            </div>`;

            // Position
            const posInfo = GTO.POSITION_INFO[state.position];
            html += `<div class="advice-card">
                <div class="advice-card-title">📍 Позиция</div>
                <div class="advice-row"><span class="label">Ты сидишь</span><span class="value">${state.position} (${posInfo.name})</span></div>
                <div class="advice-row"><span class="label">Качество позиции</span><span class="value">${'⭐'.repeat(posInfo.quality)}${'☆'.repeat(5 - posInfo.quality)}</span></div>
                <div class="advice-row"><span class="label">В диапазоне</span><span class="value">${decision.inRange ? '✅ Да' : '❌ Нет'}</span></div>
                <p style="font-size:12px;color:var(--text2);margin-top:4px">${posInfo.desc}</p>
            </div>`;

            // Mix strategy
            if (decision.mixStrategy) {
                html += renderMixStrategy(decision.mixStrategy);
            }

            // Push/Fold grid or Range grid
            if (decision.isPushFold) {
                const pfGrid = GTO.generatePushFoldGrid(state.position, decision.m, state.playerCount);
                html += renderRangeGrid(pfGrid, hand.name, state.position, 'push/fold');
            } else {
                const scenario = actions.includes('3bet') ? '3bet' :
                               actions.includes('raise') ? '3bet' : 'open';
                const grid = GTO.generateRangeGrid(state.position, scenario);
                html += renderRangeGrid(grid, hand.name, state.position, scenario);
            }

            html += '</div>';

        } else {
            // ---- POSTFLOP ----
            const activeBoardCards = state.boardCards.filter(c => c !== null);
            const boardAnalysis = GTO.analyzeBoardTexture(activeBoardCards);
            const handEval = GTO.evaluateHandOnBoard(state.myCards[0], state.myCards[1], activeBoardCards);
            const playersLeft = Math.max(2, state.playerCount);

            // Use actual opponent bet (0 = checked to us)
            const actualPot = potEst.pot + state.opponentBet;
            const betToCall = state.opponentBet;

            const decision = GTO.postflopDecision(
                handEval, boardAnalysis, actions,
                state.position, actualPot, betToCall, playersLeft, street,
                wasPreflopAggressor()
            );

            if (!decision) {
                panel.innerHTML = '<div class="advice-empty"><div>Недостаточно данных</div></div>';
                return;
            }

            html += renderHero(decision.action, decision.confidence, decision.tips[0] || '');

            html += '<div class="advice-body">';

            // Beginner tip
            html += `<div class="beginner-tip">
                <div class="beginner-tip-header">💡 Подсказка</div>
                ${decision.tips.map(t => `<p>${t}</p>`).join('')}
            </div>`;

            // Made hand
            html += `<div class="advice-card">
                <div class="advice-card-title">🃏 Твоя комбинация</div>
                <div class="advice-row"><span class="label">Рука</span><span class="value">${hand.name}</span></div>
                <div class="advice-row"><span class="label">Комбинация</span><span class="value">${decision.madeHand}${decision.madeHandDescription ? ' — ' + decision.madeHandDescription : ''}</span></div>
                ${renderStrengthMeter(decision.strengthLevel * 10)}
                <p style="font-size:12px;color:var(--text2);margin-top:6px">${decision.beginnerDesc}</p>
            </div>`;

            // Equity
            html += `<div class="advice-card">
                <div class="advice-card-title">📊 Шансы</div>
                <div class="advice-row"><span class="label">Шанс выиграть</span><span class="value" style="color:${getEquityColor(decision.equity)}">${decision.equity.toFixed(0)}%</span></div>
                <div class="equity-bar-wrap">
                    <div class="equity-bar"><div class="equity-fill" style="width:${decision.equity}%;background:${getEquityColor(decision.equity)}"></div></div>
                    <div class="equity-labels"><span>0%</span><span>50%</span><span>100%</span></div>
                </div>
                ${decision.outs > 0 ? `<div class="advice-row" style="margin-top:6px"><span class="label">Аутов (карт которые улучшат руку)</span><span class="value">${decision.outs}</span></div>` : ''}
            </div>`;

            // Draws
            if (decision.draws.length > 0) {
                html += `<div class="advice-card">
                    <div class="advice-card-title">🎯 Дро (незавершённые комбинации)</div>
                    ${decision.draws.map(d => `<div class="advice-row"><span class="value">${d}</span></div>`).join('')}
                    <p style="font-size:11px;color:var(--text3);margin-top:4px">Дро = нужна ещё 1 карта чтобы собрать комбинацию</p>
                </div>`;
            }

            // Board
            if (boardAnalysis) {
                const boardDesc = GTO.describeBoardForBeginner(boardAnalysis);
                html += `<div class="advice-card">
                    <div class="advice-card-title">🎲 Борд</div>
                    <div class="board-tags">${boardAnalysis.tags.map(t => `<span class="board-tag ${t.class}">${t.text}</span>`).join('')}</div>
                    ${boardDesc ? `<p style="font-size:12px;color:var(--text2);margin-top:6px">${boardDesc}</p>` : ''}
                </div>`;
            }

            // Mix
            if (decision.mixStrategy) {
                html += renderMixStrategy(decision.mixStrategy);
            }

            // Sizing — show exact chip amounts
            if (decision.action === 'БЕТ' || decision.action === 'РЕЙЗ') {
                html += `<div class="advice-card sizing-card">
                    <div class="advice-card-title">💰 Сколько ставить</div>`;

                if (decision.sizing && actualPot > 0) {
                    const recSize = Math.round(actualPot * decision.sizing.potPercent / 100);
                    html += `<div class="sizing-hero">
                        <div class="sizing-amount">${recSize}</div>
                        <div class="sizing-desc">${decision.sizing.potPercent}% от банка (${actualPot})</div>
                    </div>`;
                }

                // Quick sizing options in chips
                if (actualPot > 0) {
                    const opts = [
                        { pct: 25, label: '¼ пота' },
                        { pct: 33, label: '⅓ пота' },
                        { pct: 50, label: '½ пота' },
                        { pct: 67, label: '⅔ пота' },
                        { pct: 75, label: '¾ пота' },
                        { pct: 100, label: 'Пот' }
                    ];
                    const recPct = decision.sizing ? decision.sizing.potPercent : 50;
                    html += `<div class="sizing-chips-row">`;
                    opts.forEach(o => {
                        const amount = Math.round(actualPot * o.pct / 100);
                        const isRec = Math.abs(o.pct - recPct) <= 10;
                        html += `<div class="sizing-chip-item ${isRec ? 'recommended' : ''}">
                            <div class="sci-amount">${amount}</div>
                            <div class="sci-label">${o.label}</div>
                        </div>`;
                    });
                    html += `</div>`;
                }

                if (decision.action === 'РЕЙЗ' && betToCall > 0) {
                    const minRaise = betToCall * 2;
                    const potRaise = actualPot + betToCall * 2;
                    html += `<div style="margin-top:6px;font-size:11px;color:var(--text2)">
                        Мин. рейз: <b>${minRaise}</b> · Пот-сайз рейз: <b>${potRaise}</b>
                    </div>`;
                }

                html += `</div>`;
            }

            // If CALL — show how much to call and pot odds
            if (decision.action === 'КОЛЛ' && betToCall > 0) {
                const potOdds = (betToCall / (actualPot + betToCall) * 100).toFixed(0);
                html += `<div class="advice-card">
                    <div class="advice-card-title">📞 Сколько коллировать</div>
                    <div class="sizing-hero" style="background:var(--blue)">
                        <div class="sizing-amount">${betToCall}</div>
                        <div class="sizing-desc">Колл · Пот-оддсы: ${potOdds}%</div>
                    </div>
                </div>`;
            }

            html += '</div>';
        }

        panel.innerHTML = html;
    }

    // ---- RENDER HELPERS ----
    function renderHero(action, confidence, subtitle) {
        const bgMap = {
            'ФОЛД': 'fold-bg', 'ЧЕК': 'check-bg', 'ЧЕК-РЕЙЗ': 'raise-bg',
            'КОЛЛ': 'call-bg', 'БЕТ': 'raise-bg', 'РЕЙЗ': 'raise-bg',
            '3-БЕТ': 'raise-bg', '4-БЕТ': 'allin-bg', 'ОЛЛ-ИН': 'allin-bg'
        };
        return `<div class="advice-hero ${bgMap[action] || 'call-bg'}">
            <div class="advice-hero-action">${action}</div>
            ${subtitle ? `<div class="advice-hero-sub">${subtitle}</div>` : ''}
            <div class="advice-hero-confidence">Уверенность: ${confidence}%</div>
        </div>`;
    }

    function renderStrengthMeter(value) {
        const pct = Math.min(100, Math.max(0, value));
        let color = '#636e72';
        if (pct >= 80) color = '#e74c3c';
        else if (pct >= 60) color = '#e67e22';
        else if (pct >= 40) color = '#f1c40f';
        else if (pct >= 20) color = '#3498db';
        return `<div class="strength-meter">
            <div class="strength-bar"><div class="strength-fill" style="width:${pct}%;background:${color}"></div></div>
            <span class="strength-label" style="color:${color}">${pct}/100</span>
        </div>`;
    }

    function renderMixStrategy(mix) {
        let segments = '';
        if (mix.fold > 0) segments += `<div class="mix-segment fold-seg" style="flex:${mix.fold}">Фолд ${mix.fold}%</div>`;
        if (mix.call > 0) segments += `<div class="mix-segment call-seg" style="flex:${mix.call}">Колл ${mix.call}%</div>`;
        if (mix.raise > 0) segments += `<div class="mix-segment raise-seg" style="flex:${mix.raise}">Рейз ${mix.raise}%</div>`;

        return `<div class="advice-card">
            <div class="advice-card-title">🎰 Микс-стратегия GTO</div>
            <div class="mix-bar">${segments}</div>
            <p style="font-size:11px;color:var(--text3);margin-top:4px">GTO иногда рекомендует «мешать» действия чтобы быть непредсказуемым</p>
        </div>`;
    }

    function renderRangeGrid(grid, currentHand, position, scenario) {
        const scenarioNames = {
            open: 'открытия', '3bet': 'колла 3-бета', '4bet': 'колла 4-бета',
            'push/fold': 'PUSH (олл-ин)'
        };
        const isPF = scenario === 'push/fold';
        let cells = grid.map(cell => {
            let cls = 'range-cell';
            if (cell.status === 'in') cls += ' in-range';
            else if (cell.status === 'marginal') cls += ' marginal';
            if (cell.name === currentHand) cls += ' current';
            return `<div class="${cls}" title="${cell.name}">${cell.name}</div>`;
        }).join('');

        const title = isPF
            ? `🚀 Диапазон PUSH (${position})`
            : `📋 Диапазон ${scenarioNames[scenario] || 'открытия'} (${position})`;
        const desc = isPF
            ? 'Зелёным — руки с которыми идёшь олл-ин. Жёлтым — на грани (можно при хорошей ситуации). Рамка — твоя рука.'
            : 'Зелёным отмечены руки, которые стоит играть с этой позиции. Рамка — твоя рука.';

        return `<div class="advice-card">
            <div class="advice-card-title">${title}</div>
            <div class="range-grid">${cells}</div>
            <div class="range-legend">
                <span class="leg-in">${isPF ? 'Push' : 'Играть'}</span>
                <span class="leg-maybe">Может быть</span>
            </div>
            <p style="font-size:11px;color:var(--text3);margin-top:4px">${desc}</p>
        </div>`;
    }

    function getEquityColor(equity) {
        if (equity >= 70) return '#2ecc71';
        if (equity >= 45) return '#f1c40f';
        return '#e74c3c';
    }

    // ---- AUTO ANALYZE ----
    // Runs analysis automatically when we have enough data
    function autoAnalyze() {
        const hasHoleCards = state.myCards[0] && state.myCards[1];
        if (!hasHoleCards) return;
        // Always re-analyze — cards changed, opponent action changed, situation changed
        setTimeout(() => runAnalysis(), 100);
    }

    // ---- KEYBOARD CARD INPUT ----
    // Parses text like "qh10d", "AsTc", "KhQd", "qhтб" (Russian suit letters)
    function parseCardInput(text) {
        text = text.trim().toLowerCase();
        if (!text) return [];

        // Map Russian suit letters: ч=h(черви), б=d(бубны), т=c(трефы), п=s(пики)
        // Also map к→c for клубы/трефы alias
        const suitMap = {
            'h': 'h', 'd': 'd', 'c': 'c', 's': 's',
            'ч': 'h', 'б': 'd', 'т': 'c', 'п': 's', 'к': 'c',
            '♥': 'h', '♦': 'd', '♣': 'c', '♠': 's'
        };

        // Rank aliases
        const rankMap = {
            'a': 'A', 'к': 'K', 'k': 'K', 'q': 'Q', 'д': 'Q',
            'j': 'J', 'в': 'J', 't': 'T', '10': 'T',
            '9': '9', '8': '8', '7': '7', '6': '6',
            '5': '5', '4': '4', '3': '3', '2': '2'
        };

        const cards = [];
        let i = 0;
        while (i < text.length && cards.length < 7) {
            // Skip spaces and separators
            if (' ,;.-_/'.includes(text[i])) { i++; continue; }

            // Parse rank
            let rank = null;
            // Check for "10" first
            if (i + 1 < text.length && text[i] === '1' && text[i+1] === '0') {
                rank = 'T';
                i += 2;
            } else if (rankMap[text[i]]) {
                rank = rankMap[text[i]];
                i++;
            }
            if (!rank) { i++; continue; }

            // Parse suit
            if (i >= text.length) break;
            const suit = suitMap[text[i]];
            if (!suit) { i++; continue; }
            i++;

            const cardId = rank + suit;
            if (GTO.RANKS.includes(rank) && GTO.SUITS.includes(suit)) {
                cards.push(cardId);
            }
        }
        return cards;
    }

    function applyCardInput(text) {
        const cards = parseCardInput(text);
        if (cards.length === 0) return false;

        // Find the next empty slots to fill
        const slots = ['myCard1', 'myCard2', 'flop1', 'flop2', 'flop3', 'turn', 'river'];
        let slotIdx = 0;

        // Find first empty slot
        for (let si = 0; si < slots.length; si++) {
            const [arr, idx] = getSlotIndex(slots[si]);
            if (!state[arr][idx]) { slotIdx = si; break; }
            if (si === slots.length - 1) return false; // all full
        }

        for (const cardId of cards) {
            if (state.usedCards.has(cardId)) continue; // skip duplicates

            // Find next empty slot
            while (slotIdx < slots.length) {
                const [arr, idx] = getSlotIndex(slots[slotIdx]);
                if (!state[arr][idx]) break;
                slotIdx++;
            }
            if (slotIdx >= slots.length) break;

            const [arr, idx] = getSlotIndex(slots[slotIdx]);
            state.usedCards.add(cardId);
            state[arr][idx] = cardId;
            slotIdx++;
        }

        renderCardSlots();
        updateStreetProgress();
        updatePot();
        autoAnalyze();
        return true;
    }

    // ---- EVENT LISTENERS ----
    function init() {
        renderTable();
        renderCardSlots();
        updateStreetProgress();
        updatePot();

        // Card slots
        document.querySelectorAll('.card-slot').forEach(slot => {
            slot.addEventListener('click', () => openCardPicker(slot.dataset.slot));
            slot.addEventListener('contextmenu', (e) => { e.preventDefault(); clearCardSlot(slot.dataset.slot); });
        });

        // Card picker
        document.getElementById('closePicker').addEventListener('click', closeCardPicker);
        document.getElementById('cardPickerOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('cardPickerOverlay')) closeCardPicker();
        });

        // Player count
        document.getElementById('playerMinus').addEventListener('click', () => {
            if (state.playerCount > 2) {
                state.playerCount--;
                document.getElementById('playerCount').textContent = state.playerCount;
                const active = getActivePositions();
                if (!active.includes(state.position)) state.position = active[active.length - 3] || active[0];
                renderTable();
                updatePot();
            }
        });
        document.getElementById('playerPlus').addEventListener('click', () => {
            if (state.playerCount < 9) {
                state.playerCount++;
                document.getElementById('playerCount').textContent = state.playerCount;
                renderTable();
                updatePot();
            }
        });

        // Tournament inputs
        ['blindSize', 'stackSize', 'anteSize', 'playersRemaining', 'paidPlaces'].forEach(id => {
            const el = document.getElementById(id);
            el.addEventListener('change', updatePot);
            el.addEventListener('input', updatePot);
        });

        // Keyboard card input
        const cardInput = document.getElementById('cardInput');
        cardInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const text = cardInput.value.trim();
                if (text) {
                    applyCardInput(text);
                    cardInput.value = '';
                }
            }
        });

        // Situation buttons
        document.querySelectorAll('.btn-situation').forEach(btn => {
            btn.addEventListener('click', () => setSituation(btn.dataset.situation));
        });

        // Opponent postflop action
        document.getElementById('oppFirst').addEventListener('click', () => setOpponentAction('first'));
        document.getElementById('oppCheck').addEventListener('click', () => setOpponentAction('check'));
        document.getElementById('oppBet').addEventListener('click', () => setOpponentAction('bet'));
        const oppBetSize = document.getElementById('oppBetSize');
        oppBetSize.addEventListener('input', updateOpponentBet);
        oppBetSize.addEventListener('change', updateOpponentBet);

        // Quick bet size buttons
        document.querySelectorAll('.btn-bet-quick').forEach(btn => {
            btn.addEventListener('click', () => {
                handleQuickBet(parseInt(btn.dataset.pct));
            });
        });

        // New hand
        document.getElementById('newHandBtn').addEventListener('click', newHand);

        // Analyze
        document.getElementById('getAdvice').addEventListener('click', runAnalysis);

        // Cheat sheet
        document.getElementById('toggleCheatSheet').addEventListener('click', () => {
            document.getElementById('cheatSheet').classList.add('show');
        });
        document.getElementById('closeCheatSheet').addEventListener('click', () => {
            document.getElementById('cheatSheet').classList.remove('show');
        });
        document.getElementById('cheatSheet').addEventListener('click', (e) => {
            if (e.target === document.getElementById('cheatSheet')) {
                document.getElementById('cheatSheet').classList.remove('show');
            }
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeCardPicker();
                document.getElementById('cheatSheet').classList.remove('show');
            }
            if (e.key === 'Enter' && !document.getElementById('cardPickerOverlay').classList.contains('show') && document.activeElement.id !== 'cardInput') {
                runAnalysis();
            }
        });
    }

    init();
})();
