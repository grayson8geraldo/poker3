// ============================================================
// APP.JS - UI Controller for GTO Poker Advisor
// ============================================================

(function() {
    'use strict';

    // ---- STATE ----
    const state = {
        myCards: [null, null],          // ['Ah', 'Kd']
        boardCards: [null, null, null, null, null], // [flop1, flop2, flop3, turn, river]
        position: 'BTN',
        playerCount: 8,
        actions: [],                    // ['fold', 'raise', 'fold', ...]
        handNumber: 1,
        potSize: 0,
        betSize: 0,
        activeSlot: null,               // which card slot is being filled
        usedCards: new Set(),            // track dealt cards
    };

    // ---- POSITION SETUP ----
    const positions8 = ['UTG', 'UTG+1', 'MP', 'MP+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
    // For fewer players, trim from early positions
    function getActivePositions() {
        const n = state.playerCount;
        if (n >= 9) return positions8;
        // Always keep BTN, SB, BB, CO, HJ; trim early positions
        const allPos = ['UTG', 'UTG+1', 'MP', 'MP+1', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
        const keep = allPos.slice(allPos.length - n);
        return keep;
    }

    function renderPositions() {
        const container = document.getElementById('positionSeats');
        container.innerHTML = '';
        const active = getActivePositions();
        active.forEach(pos => {
            const seat = document.createElement('div');
            seat.className = 'seat' + (pos === state.position ? ' active' : '');
            seat.textContent = pos;
            seat.addEventListener('click', () => {
                state.position = pos;
                renderPositions();
            });
            container.appendChild(seat);
        });
    }

    // ---- CARD PICKER ----
    const SUITS_DISPLAY = [
        { key: 'h', name: 'hearts', symbol: '♥', color: 'red' },
        { key: 'd', name: 'diamonds', symbol: '♦', color: 'blue' },
        { key: 'c', name: 'clubs', symbol: '♣', color: 'green-suit' },
        { key: 's', name: 'spades', symbol: '♠', color: 'black' }
    ];

    function buildCardPicker() {
        const container = document.getElementById('pickerSuits');
        container.innerHTML = '';

        SUITS_DISPLAY.forEach(suit => {
            const section = document.createElement('div');
            section.className = 'picker-suit-section';

            const label = document.createElement('div');
            label.className = 'picker-suit-label ' + suit.name;
            label.textContent = suit.symbol;
            section.appendChild(label);

            const cards = document.createElement('div');
            cards.className = 'picker-cards';

            GTO.RANKS.forEach(rank => {
                const card = document.createElement('div');
                const cardId = rank + suit.key;
                card.className = 'picker-card ' + suit.name;
                if (state.usedCards.has(cardId)) card.classList.add('used');
                card.textContent = rank;
                card.addEventListener('click', () => selectCard(cardId));
                cards.appendChild(card);
            });

            section.appendChild(cards);
            container.appendChild(section);
        });
    }

    function openCardPicker(slotId) {
        state.activeSlot = slotId;
        buildCardPicker();
        document.getElementById('cardPickerOverlay').classList.add('show');
    }

    function closeCardPicker() {
        document.getElementById('cardPickerOverlay').classList.remove('show');
        state.activeSlot = null;
    }

    function selectCard(cardId) {
        if (state.usedCards.has(cardId)) return;

        const slot = state.activeSlot;
        if (!slot) return;

        // Remove old card from used set
        let oldCard = null;
        if (slot === 'myCard1') oldCard = state.myCards[0];
        else if (slot === 'myCard2') oldCard = state.myCards[1];
        else if (slot === 'flop1') oldCard = state.boardCards[0];
        else if (slot === 'flop2') oldCard = state.boardCards[1];
        else if (slot === 'flop3') oldCard = state.boardCards[2];
        else if (slot === 'turn') oldCard = state.boardCards[3];
        else if (slot === 'river') oldCard = state.boardCards[4];

        if (oldCard) state.usedCards.delete(oldCard);

        // Set new card
        state.usedCards.add(cardId);
        if (slot === 'myCard1') state.myCards[0] = cardId;
        else if (slot === 'myCard2') state.myCards[1] = cardId;
        else if (slot === 'flop1') state.boardCards[0] = cardId;
        else if (slot === 'flop2') state.boardCards[1] = cardId;
        else if (slot === 'flop3') state.boardCards[2] = cardId;
        else if (slot === 'turn') state.boardCards[3] = cardId;
        else if (slot === 'river') state.boardCards[4] = cardId;

        renderCardSlots();
        closeCardPicker();

        // Auto-open next empty slot
        autoOpenNext(slot);
    }

    function autoOpenNext(currentSlot) {
        const order = ['myCard1', 'myCard2', 'flop1', 'flop2', 'flop3', 'turn', 'river'];
        const idx = order.indexOf(currentSlot);
        for (let i = idx + 1; i < order.length; i++) {
            const s = order[i];
            let val = null;
            if (s === 'myCard1') val = state.myCards[0];
            else if (s === 'myCard2') val = state.myCards[1];
            else if (s === 'flop1') val = state.boardCards[0];
            else if (s === 'flop2') val = state.boardCards[1];
            else if (s === 'flop3') val = state.boardCards[2];
            else if (s === 'turn') val = state.boardCards[3];
            else if (s === 'river') val = state.boardCards[4];

            if (!val) {
                // Only auto-open my cards and flop in sequence; turn/river on demand
                if (i <= 4) {
                    setTimeout(() => openCardPicker(s), 150);
                }
                return;
            }
        }
    }

    function clearCardSlot(slotId) {
        let oldCard = null;
        if (slotId === 'myCard1') { oldCard = state.myCards[0]; state.myCards[0] = null; }
        else if (slotId === 'myCard2') { oldCard = state.myCards[1]; state.myCards[1] = null; }
        else if (slotId === 'flop1') { oldCard = state.boardCards[0]; state.boardCards[0] = null; }
        else if (slotId === 'flop2') { oldCard = state.boardCards[1]; state.boardCards[1] = null; }
        else if (slotId === 'flop3') { oldCard = state.boardCards[2]; state.boardCards[2] = null; }
        else if (slotId === 'turn') { oldCard = state.boardCards[3]; state.boardCards[3] = null; }
        else if (slotId === 'river') { oldCard = state.boardCards[4]; state.boardCards[4] = null; }

        if (oldCard) state.usedCards.delete(oldCard);
        renderCardSlots();
    }

    function renderCardSlots() {
        const slots = {
            'myCard1': state.myCards[0],
            'myCard2': state.myCards[1],
            'flop1': state.boardCards[0],
            'flop2': state.boardCards[1],
            'flop3': state.boardCards[2],
            'turn': state.boardCards[3],
            'river': state.boardCards[4]
        };

        for (const [id, card] of Object.entries(slots)) {
            const el = document.getElementById(id);
            if (card) {
                const rank = card[0];
                const suit = card[1];
                const suitInfo = SUITS_DISPLAY.find(s => s.key === suit);
                el.innerHTML = `<span class="card-rank">${rank}</span><span class="card-suit">${suitInfo.symbol}</span>`;
                el.className = 'card-slot filled ' + suitInfo.color;
                if (id.startsWith('flop') || id === 'turn' || id === 'river') {
                    el.classList.add('board');
                }
                if (id === 'turn') el.classList.add('turn-card');
                if (id === 'river') el.classList.add('river-card');
            } else {
                el.innerHTML = '?';
                el.className = 'card-slot' + (['flop1','flop2','flop3','turn','river'].includes(id) ? ' board' : '');
                if (id === 'turn') el.classList.add('turn-card');
                if (id === 'river') el.classList.add('river-card');
            }
        }
    }

    // ---- ACTIONS ----
    function addAction(actionType) {
        state.actions.push(actionType);
        renderActions();
    }

    function undoAction() {
        state.actions.pop();
        renderActions();
    }

    function renderActions() {
        const log = document.getElementById('actionLog');
        log.innerHTML = '';
        const classMap = { fold: 'fold', limp: 'limp', call: 'call', raise: 'raise', '3bet': 'bet3', '4bet': 'bet4', allin: 'allin' };
        const nameMap = { fold: 'Fold', limp: 'Limp', call: 'Call', raise: 'Raise', '3bet': '3-Bet', '4bet': '4-Bet', allin: 'All-In' };

        state.actions.forEach((a, i) => {
            const tag = document.createElement('span');
            tag.className = 'action-tag ' + (classMap[a] || '');
            tag.textContent = `#${i + 1} ${nameMap[a] || a}`;
            log.appendChild(tag);
        });
    }

    // ---- NEW HAND ----
    function newHand() {
        // Advance position
        const active = getActivePositions();
        const currentIdx = active.indexOf(state.position);
        const nextIdx = (currentIdx + 1) % active.length;
        state.position = active[nextIdx];

        // Clear cards
        state.myCards = [null, null];
        state.boardCards = [null, null, null, null, null];
        state.actions = [];
        state.usedCards.clear();
        state.potSize = 0;
        state.betSize = 0;
        state.handNumber++;

        // Update UI
        document.getElementById('handNumber').textContent = state.handNumber;
        document.getElementById('potSize').value = 0;
        document.getElementById('betSize').value = 0;
        renderPositions();
        renderCardSlots();
        renderActions();

        // Clear advice
        document.getElementById('advicePanel').innerHTML = '<div class="advice-placeholder">Введите карты и нажмите АНАЛИЗ</div>';
    }

    // ---- ANALYSIS ----
    function runAnalysis() {
        const panel = document.getElementById('advicePanel');

        // Validate minimum input
        if (!state.myCards[0] || !state.myCards[1]) {
            panel.innerHTML = '<div class="advice-placeholder">Выберите обе свои карты</div>';
            return;
        }

        state.potSize = parseInt(document.getElementById('potSize').value) || 0;
        state.betSize = parseInt(document.getElementById('betSize').value) || 0;

        const hand = GTO.classifyHand(state.myCards[0], state.myCards[1]);
        const score = GTO.handStrengthScore(hand);

        // Determine street
        const boardCount = state.boardCards.filter(c => c !== null).length;
        let street = 'preflop';
        if (boardCount >= 5) street = 'river';
        else if (boardCount >= 4) street = 'turn';
        else if (boardCount >= 3) street = 'flop';

        let html = '';

        if (street === 'preflop') {
            // ---- PREFLOP ----
            const decision = GTO.preflopDecision(hand, state.position, state.actions, state.playerCount);

            html += renderDecision(decision.action, decision.confidence);

            // Hand info
            html += `<div class="advice-section">
                <h4>Рука</h4>
                <div class="advice-row"><span class="label">Комбинация</span><span class="value">${hand.name}</span></div>
                <div class="advice-row"><span class="label">Тип</span><span class="value">${hand.pair ? 'Пара' : (hand.suited ? 'Suited' : 'Offsuit')}${hand.connected ? ', коннектор' : ''}</span></div>
                <div class="advice-row"><span class="label">Рейтинг силы</span><span class="value">${score.toFixed(0)}/100</span></div>
                ${renderStrengthMeter(Math.ceil(score / 10))}
            </div>`;

            // Position info
            html += `<div class="advice-section">
                <h4>Позиция</h4>
                <div class="advice-row"><span class="label">Моя позиция</span><span class="value">${state.position}</span></div>
                <div class="advice-row"><span class="label">Игроков</span><span class="value">${state.playerCount}</span></div>
                <div class="advice-row"><span class="label">В раздаче</span><span class="value">${decision.playersLeft}</span></div>
                <div class="advice-row"><span class="label">В диапазоне открытия</span><span class="value">${decision.inRange ? 'Да ✓' : 'Нет ✗'}</span></div>
            </div>`;

            // Mix strategy
            if (decision.mixStrategy) {
                html += renderMixStrategy(decision.mixStrategy);
            }

            // Range grid
            const scenario = state.actions.includes('3bet') ? '3bet' :
                           state.actions.includes('raise') ? '3bet' : 'open';
            const grid = GTO.generateRangeGrid(state.position, scenario);
            html += renderRangeGrid(grid, hand.name);

        } else {
            // ---- POSTFLOP ----
            const activeBoardCards = state.boardCards.filter(c => c !== null);
            const boardAnalysis = GTO.analyzeBoardTexture(activeBoardCards);
            const handEval = GTO.evaluateHandOnBoard(state.myCards[0], state.myCards[1], activeBoardCards);
            const foldCount = state.actions.filter(a => a === 'fold').length;
            const playersLeft = state.playerCount - foldCount;

            const decision = GTO.postflopDecision(
                handEval, boardAnalysis, state.actions,
                state.position, state.potSize, state.betSize, playersLeft
            );

            if (!decision) {
                panel.innerHTML = '<div class="advice-placeholder">Недостаточно данных для анализа</div>';
                return;
            }

            html += renderDecision(decision.action, decision.confidence);

            // Made hand
            html += `<div class="advice-section">
                <h4>Оценка руки</h4>
                <div class="advice-row"><span class="label">Рука</span><span class="value">${hand.name}</span></div>
                <div class="advice-row"><span class="label">Готовая комбинация</span><span class="value">${decision.madeHand}</span></div>
                ${decision.madeHandDescription ? `<div class="advice-row"><span class="label">Описание</span><span class="value">${decision.madeHandDescription}</span></div>` : ''}
                ${renderStrengthMeter(decision.strengthLevel)}
            </div>`;

            // Equity
            html += `<div class="advice-section">
                <h4>Эквити и оддсы</h4>
                <div class="advice-row"><span class="label">Эквити</span><span class="value">${decision.equity.toFixed(0)}%</span></div>
                <div class="equity-bar"><div class="equity-fill" style="width:${decision.equity}%;background:${getEquityColor(decision.equity)}"></div></div>
                ${decision.potOdds > 0 ? `<div class="advice-row"><span class="label">Пот-оддсы</span><span class="value">${decision.potOdds.toFixed(1)}%</span></div>` : ''}
                ${decision.outs > 0 ? `<div class="advice-row"><span class="label">Ауты</span><span class="value">${decision.outs}</span></div>` : ''}
            </div>`;

            // Draws
            if (decision.draws.length > 0) {
                html += `<div class="advice-section">
                    <h4>Дро</h4>
                    ${decision.draws.map(d => `<div class="advice-row"><span class="value">${d}</span></div>`).join('')}
                </div>`;
            }

            // Board analysis
            if (boardAnalysis) {
                html += `<div class="advice-section">
                    <h4>Анализ борда</h4>
                    <div class="advice-row"><span class="label">Влажность</span><span class="value">${boardAnalysis.wetness}% ${boardAnalysis.wetness >= 50 ? '(мокрый)' : '(сухой)'}</span></div>
                    <div class="equity-bar"><div class="equity-fill" style="width:${boardAnalysis.wetness}%;background:#0984e3"></div></div>
                    <div class="board-tags">${boardAnalysis.tags.map(t => `<span class="board-tag ${t.class}">${t.text}</span>`).join('')}</div>
                </div>`;
            }

            // Mix strategy
            if (decision.mixStrategy) {
                html += renderMixStrategy(decision.mixStrategy);
            }

            // Bet sizing
            if (decision.action === 'BET' || decision.action === 'RAISE') {
                const sizes = GTO.getSizingRecommendation(boardAnalysis, decision.strengthLevel, street, state.potSize);
                if (sizes.length > 0) {
                    html += `<div class="advice-section">
                        <h4>Рекомендуемый сайзинг</h4>
                        <div class="sizing-options">
                            ${sizes.map(s => `<span class="sizing-chip ${s.recommended ? 'recommended' : ''}" title="${s.reason}">${s.label}</span>`).join('')}
                        </div>
                        ${sizes.filter(s => s.recommended).map(s => `<div class="advice-row" style="margin-top:4px"><span class="label">${s.reason}</span></div>`).join('')}
                    </div>`;
                }
            }

            // Reasoning
            if (decision.reasoning.length > 0) {
                html += `<div class="advice-section">
                    <h4>Логика решения</h4>
                    ${decision.reasoning.map(r => `<div class="advice-row"><span class="value">• ${r}</span></div>`).join('')}
                </div>`;
            }
        }

        panel.innerHTML = html;
    }

    // ---- RENDER HELPERS ----
    function renderDecision(action, confidence) {
        const classMap = {
            'FOLD': 'fold-rec', 'CHECK': 'fold-rec', 'CHECK-RAISE': 'raise-rec',
            'CALL': 'call-rec', 'BET': 'raise-rec', 'RAISE': 'raise-rec',
            '3-BET': 'raise-rec', '4-BET': 'allin-rec', 'ALL-IN': 'allin-rec'
        };
        return `<div class="advice-decision">
            <div class="advice-action ${classMap[action] || ''}">${action}</div>
            <div class="advice-confidence">Уверенность: ${confidence}%</div>
        </div>`;
    }

    function renderStrengthMeter(level) {
        let dots = '';
        for (let i = 1; i <= 10; i++) {
            let cls = '';
            if (i <= level) {
                if (level >= 8) cls = 'active strong';
                else if (level >= 5) cls = 'active medium';
                else cls = 'active';
            }
            dots += `<div class="strength-dot ${cls}"></div>`;
        }
        const labels = ['', 'Очень слабая', 'Слабая', 'Ниже среднего', 'Средняя', 'Выше среднего', 'Сильная', 'Очень сильная', 'Монстр', 'Натс', 'Абсолютный натс'];
        return `<div class="strength-meter">
            <div class="strength-dots">${dots}</div>
            <span class="strength-label">${labels[level] || ''}</span>
        </div>`;
    }

    function renderMixStrategy(mix) {
        let segments = '';
        if (mix.fold > 0) segments += `<div class="mix-segment fold-seg" style="flex:${mix.fold}">Fold ${mix.fold}%</div>`;
        if (mix.call > 0) segments += `<div class="mix-segment call-seg" style="flex:${mix.call}">Call ${mix.call}%</div>`;
        if (mix.raise > 0) segments += `<div class="mix-segment raise-seg" style="flex:${mix.raise}">Raise ${mix.raise}%</div>`;

        return `<div class="advice-section">
            <h4>Микс-стратегия (GTO)</h4>
            <div class="mix-bar">${segments}</div>
        </div>`;
    }

    function renderRangeGrid(grid, currentHand) {
        // Normalize current hand name for matching
        const normalizedCurrent = currentHand;

        let cells = '';
        grid.forEach(cell => {
            let cls = 'range-cell';
            if (cell.status === 'in') cls += ' in-range';
            else if (cell.status === 'marginal') cls += ' marginal';

            // Highlight current hand
            const isCurrent = cell.name === normalizedCurrent;
            const style = isCurrent ? 'outline:2px solid #e94560;outline-offset:-1px;' : '';

            cells += `<div class="${cls}" style="${style}" title="${cell.name}: ${cell.score}">${cell.name}</div>`;
        });

        return `<div class="advice-section">
            <h4>Диапазон открытия (${state.position})</h4>
            <div class="range-grid">${cells}</div>
            <div class="advice-row" style="margin-top:5px">
                <span class="label" style="font-size:10px">
                    <span style="color:var(--green)">■</span> В диапазоне
                    <span style="color:var(--yellow);margin-left:6px">■</span> Маргинал
                </span>
            </div>
        </div>`;
    }

    function getEquityColor(equity) {
        if (equity >= 70) return 'var(--green)';
        if (equity >= 45) return 'var(--yellow)';
        return 'var(--accent)';
    }

    // ---- EVENT LISTENERS ----
    function init() {
        renderPositions();
        renderCardSlots();

        // Card slot clicks (left click = pick, right click = clear)
        document.querySelectorAll('.card-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                openCardPicker(slot.dataset.slot);
            });
            slot.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                clearCardSlot(slot.dataset.slot);
            });
        });

        // Close picker
        document.getElementById('closePicker').addEventListener('click', closeCardPicker);
        document.getElementById('cardPickerOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('cardPickerOverlay')) closeCardPicker();
        });

        // Keyboard shortcut to close picker
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeCardPicker();
        });

        // Player slider
        document.getElementById('playerSlider').addEventListener('input', (e) => {
            state.playerCount = parseInt(e.target.value);
            document.getElementById('playerCount').textContent = state.playerCount;
            // Ensure position is still valid
            const active = getActivePositions();
            if (!active.includes(state.position)) {
                state.position = active[active.length - 3] || active[0]; // Default to BTN
            }
            renderPositions();
        });

        // Action buttons
        document.querySelectorAll('.btn-action').forEach(btn => {
            btn.addEventListener('click', () => {
                addAction(btn.dataset.action);
            });
        });

        // Undo action
        document.getElementById('undoAction').addEventListener('click', undoAction);

        // New hand
        document.getElementById('newHandBtn').addEventListener('click', newHand);

        // Analyze
        document.getElementById('getAdvice').addEventListener('click', runAnalysis);

        // Keyboard shortcut: Enter = analyze
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !document.getElementById('cardPickerOverlay').classList.contains('show')) {
                runAnalysis();
            }
        });
    }

    // Start
    init();
})();
