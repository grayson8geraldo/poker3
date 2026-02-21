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
        actions: [],
        handNumber: 1,
        blindSize: 100,
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
    // Seat positions around an oval table (percentages)
    const seatLayout8 = [
        { left: 50, top: 100 },  // BB (bottom center)
        { left: 15, top: 88 },   // SB (bottom left)
        { left: 0,  top: 55 },   // BTN (left)
        { left: 5,  top: 20 },   // CO (top left)
        { left: 25, top: 0 },    // HJ (top)
        { left: 50, top: 0 },    // MP+1 (top center)
        { left: 75, top: 0 },    // MP (top right)
        { left: 95, top: 20 },   // UTG+1 (right top)
        { left: 100,top: 55 },   // UTG (right)
    ];

    function renderTable() {
        const ring = document.getElementById('seatsRing');
        ring.innerHTML = '';
        const positions = getActivePositions();
        const info = document.getElementById('tableInfo');

        // Place seats around the table
        // We reverse positions so BB is at bottom, then go clockwise
        const reversed = [...positions].reverse();
        const total = reversed.length;

        reversed.forEach((pos, i) => {
            const posInfo = GTO.POSITION_INFO[pos];
            const seat = document.createElement('div');
            seat.className = 'seat' + (pos === state.position ? ' active' : '');

            // Calculate position
            const angle = (i / total) * Math.PI * 2 - Math.PI / 2;
            const radiusX = 46;
            const radiusY = 38;
            const cx = 50 + radiusX * Math.cos(angle);
            const cy = 54 + radiusY * Math.sin(angle);

            seat.style.left = cx + '%';
            seat.style.top = cy + '%';
            seat.style.transform = 'translate(-50%, -50%)';

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

            ring.appendChild(seat);
        });

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

        const [arr, idx] = getSlotIndex(slot);
        const oldCard = state[arr][idx];
        if (oldCard) state.usedCards.delete(oldCard);

        state.usedCards.add(cardId);
        state[arr][idx] = cardId;

        renderCardSlots();
        updateStreetProgress();
        updatePot();
        closeCardPicker();
        autoOpenNext(slot);
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
        const order = ['myCard1', 'myCard2', 'flop1', 'flop2', 'flop3', 'turn', 'river'];
        const idx = order.indexOf(currentSlot);
        for (let i = idx + 1; i < order.length; i++) {
            const s = order[i];
            const [arr, j] = getSlotIndex(s);
            if (!state[arr][j]) {
                if (i <= 4) { // auto-open through flop
                    setTimeout(() => openCardPicker(s), 180);
                }
                return;
            }
        }
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

    // ---- ACTIONS ----
    function addAction(actionType) {
        state.actions.push(actionType);
        renderActions();
        updatePot();
    }

    function undoAction() {
        state.actions.pop();
        renderActions();
        updatePot();
    }

    function renderActions() {
        const log = document.getElementById('actionLog');
        log.innerHTML = '';
        const classMap = { fold: 'fold', limp: 'limp', call: 'call', raise: 'raise', '3bet': 'bet3', allin: 'allin' };
        const nameMap = { fold: 'Фолд', limp: 'Лимп', call: 'Колл', raise: 'Рейз', '3bet': '3-Бет', allin: 'Олл-ин' };

        if (state.actions.length === 0) {
            log.innerHTML = '<span class="action-log-empty">Пока никто не действовал</span>';
            return;
        }

        state.actions.forEach((a, i) => {
            const tag = document.createElement('span');
            tag.className = 'action-tag ' + (classMap[a] || '');
            tag.textContent = `${nameMap[a] || a}`;
            log.appendChild(tag);
        });
    }

    // ---- POT CALCULATION ----
    function updatePot() {
        state.blindSize = parseInt(document.getElementById('blindSize').value) || 100;
        const est = GTO.estimatePot(state.actions, state.blindSize, state.playerCount);
        document.getElementById('potValue').textContent = est.pot;
    }

    // ---- NEW HAND ----
    function newHand() {
        const active = getActivePositions();
        const currentIdx = active.indexOf(state.position);
        const nextIdx = (currentIdx + 1) % active.length;
        state.position = active[nextIdx];

        state.myCards = [null, null];
        state.boardCards = [null, null, null, null, null];
        state.actions = [];
        state.usedCards.clear();
        state.handNumber++;

        document.getElementById('handNumber').textContent = state.handNumber;
        renderTable();
        renderCardSlots();
        renderActions();
        updateStreetProgress();
        updatePot();

        document.getElementById('advicePanel').innerHTML = `
            <div class="advice-empty">
                <div class="advice-empty-icon">🃏</div>
                <div>Выбери свои карты и нажми <strong>«ЧТО ДЕЛАТЬ?»</strong></div>
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

        state.blindSize = parseInt(document.getElementById('blindSize').value) || 100;
        const potEst = GTO.estimatePot(state.actions, state.blindSize, state.playerCount);

        const hand = GTO.classifyHand(state.myCards[0], state.myCards[1]);
        const score = GTO.handStrengthScore(hand);
        const category = GTO.getHandCategory(score);
        const nickname = GTO.getHandNickname(hand.name);
        const handDesc = GTO.describeHandForBeginner(hand);

        const street = getCurrentStreet();
        let html = '';

        if (street === 'preflop') {
            const decision = GTO.preflopDecision(hand, state.position, state.actions, state.playerCount);
            html += renderHero(decision.action, decision.confidence, decision.tips[0] || '');

            html += '<div class="advice-body">';

            // Beginner tip
            html += `<div class="beginner-tip">
                <div class="beginner-tip-header">💡 Подсказка</div>
                ${decision.tips.map(t => `<p>${t}</p>`).join('')}
            </div>`;

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

            // Range grid
            const scenario = state.actions.includes('3bet') ? '3bet' :
                           state.actions.includes('raise') ? '3bet' : 'open';
            const grid = GTO.generateRangeGrid(state.position, scenario);
            html += renderRangeGrid(grid, hand.name, state.position, scenario);

            html += '</div>';

        } else {
            // ---- POSTFLOP ----
            const activeBoardCards = state.boardCards.filter(c => c !== null);
            const boardAnalysis = GTO.analyzeBoardTexture(activeBoardCards);
            const handEval = GTO.evaluateHandOnBoard(state.myCards[0], state.myCards[1], activeBoardCards);
            const foldCount = state.actions.filter(a => a === 'fold').length;
            const playersLeft = Math.max(2, state.playerCount - foldCount);

            const decision = GTO.postflopDecision(
                handEval, boardAnalysis, state.actions,
                state.position, potEst.pot, potEst.currentBet, playersLeft, street
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

            // Sizing
            if (decision.action === 'БЕТ' || decision.action === 'РЕЙЗ') {
                const sizes = GTO.getSizingRecommendation(boardAnalysis, decision.strengthLevel, street, potEst.pot);
                if (sizes.length > 0) {
                    html += `<div class="advice-card">
                        <div class="advice-card-title">💰 Сколько ставить</div>
                        <div class="sizing-options">
                            ${sizes.map(s => `<span class="sizing-chip ${s.recommended ? 'recommended' : ''}">${s.label}</span>`).join('')}
                        </div>
                        ${sizes.filter(s => s.recommended).map(s => `<div class="sizing-reason">${s.reason}</div>`).join('')}
                    </div>`;
                }
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
        const scenarioNames = { open: 'открытия', '3bet': 'колла 3-бета', '4bet': 'колла 4-бета' };
        let cells = grid.map(cell => {
            let cls = 'range-cell';
            if (cell.status === 'in') cls += ' in-range';
            else if (cell.status === 'marginal') cls += ' marginal';
            if (cell.name === currentHand) cls += ' current';
            return `<div class="${cls}" title="${cell.name}">${cell.name}</div>`;
        }).join('');

        return `<div class="advice-card">
            <div class="advice-card-title">📋 Диапазон ${scenarioNames[scenario] || 'открытия'} (${position})</div>
            <div class="range-grid">${cells}</div>
            <div class="range-legend">
                <span class="leg-in">Играть</span>
                <span class="leg-maybe">Может быть</span>
            </div>
            <p style="font-size:11px;color:var(--text3);margin-top:4px">Зелёным отмечены руки, которые стоит играть с этой позиции. Рамка — твоя рука.</p>
        </div>`;
    }

    function getEquityColor(equity) {
        if (equity >= 70) return '#2ecc71';
        if (equity >= 45) return '#f1c40f';
        return '#e74c3c';
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

        // Blind size
        document.getElementById('blindSize').addEventListener('change', updatePot);
        document.getElementById('blindSize').addEventListener('input', updatePot);

        // Actions
        document.querySelectorAll('.btn-action').forEach(btn => {
            btn.addEventListener('click', () => addAction(btn.dataset.action));
        });
        document.getElementById('undoAction').addEventListener('click', undoAction);

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
            if (e.key === 'Enter' && !document.getElementById('cardPickerOverlay').classList.contains('show')) {
                runAnalysis();
            }
        });
    }

    init();
})();
