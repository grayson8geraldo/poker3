// ============================================================
// GTO POKER ENGINE v2 - Texas Hold'em 8-max
// With beginner-friendly explanations
// ============================================================

const GTO = (() => {

    const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
    const SUITS = ['h','d','c','s'];
    const RANK_VALUES = {
        '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14
    };
    const RANK_NAMES_RU = {
        '2':'2','3':'3','4':'4','5':'5','6':'6','7':'7','8':'8','9':'9',
        'T':'10','J':'Валет','Q':'Дама','K':'Король','A':'Туз'
    };

    const POSITIONS_8MAX = ['UTG','UTG+1','MP','MP+1','HJ','CO','BTN','SB','BB'];

    const POSITION_INFO = {
        'UTG':   { name: 'Under the Gun', short: 'UTG',   desc: 'Первый ходит. Самая плохая позиция — играй только сильные карты!', quality: 1 },
        'UTG+1': { name: 'Under the Gun +1', short: 'UTG+1', desc: 'Второй ходит. Почти так же плохо как UTG.', quality: 1 },
        'MP':    { name: 'Middle Position', short: 'MP',    desc: 'Средняя позиция. Чуть свободнее, но всё ещё осторожно.', quality: 2 },
        'MP+1':  { name: 'Middle Position +1', short: 'MP+1', desc: 'Средняя позиция. Можно играть чуть больше рук.', quality: 2 },
        'HJ':    { name: 'Hijack', short: 'HJ',     desc: 'Хайджек. Хорошая позиция — начинаем расширять диапазон.', quality: 3 },
        'CO':    { name: 'Cutoff', short: 'CO',     desc: 'Катофф. Очень хорошая позиция — можно играть много рук.', quality: 4 },
        'BTN':   { name: 'Button (Баттон)', short: 'BTN',   desc: 'Баттон — ЛУЧШАЯ позиция! Ты ходишь последним, видишь все действия.', quality: 5 },
        'SB':    { name: 'Small Blind', short: 'SB',     desc: 'Малый блайнд. Плохая позиция — ты уже вложил фишки и ходишь первым после флопа.', quality: 1 },
        'BB':    { name: 'Big Blind', short: 'BB',     desc: 'Большой блайнд. Ты уже вложил 1 ББ — можешь защищать чаще.', quality: 2 }
    };

    // ---- HAND CLASSIFICATION ----
    function classifyHand(card1, card2) {
        const r1 = card1[0], s1 = card1[1];
        const r2 = card2[0], s2 = card2[1];
        const v1 = RANK_VALUES[r1], v2 = RANK_VALUES[r2];
        const suited = s1 === s2;
        const pair = r1 === r2;
        const high = Math.max(v1, v2);
        const low = Math.min(v1, v2);
        const gap = high - low;
        const connected = gap === 1;
        const oneGap = gap === 2;
        const twoGap = gap === 3;

        let name;
        const h = RANKS[high - 2];
        const l = RANKS[low - 2];
        if (pair) name = h + l;
        else if (suited) name = h + l + 's';
        else name = h + l + 'o';

        return { name, high, low, gap, suited, pair, connected, oneGap, twoGap, v1, v2 };
    }

    function getHandNickname(name) {
        const nicknames = {
            'AA': 'Тузы (ракеты)', 'KK': 'Короли (ковбои)', 'QQ': 'Дамы (леди)',
            'JJ': 'Валеты (хуки)', 'TT': 'Десятки', 'AKs': 'Большой Слик (suited)',
            'AKo': 'Большой Слик', 'AQs': 'Большая Чик', 'AJs': 'Блэкджек',
            'KQs': 'Королевская свадьба', 'JTs': 'Динамит'
        };
        return nicknames[name] || null;
    }

    function describeHandForBeginner(hand) {
        const hn = RANK_NAMES_RU[RANKS[hand.high - 2]];
        const ln = RANK_NAMES_RU[RANKS[hand.low - 2]];

        if (hand.pair) {
            if (hand.high >= 11) return `Пара ${hn}ов — это очень сильная стартовая рука!`;
            if (hand.high >= 8) return `Пара ${hn}ок — средняя пара, играй аккуратно.`;
            return `Пара ${hn}ок — маленькая пара. Надеемся попасть в сет (тройку) на флопе.`;
        }
        if (hand.suited && hand.connected) {
            return `${hn}+${ln} одной масти и подряд — хороший потенциал для стрита и флеша!`;
        }
        if (hand.suited) {
            return `${hn}+${ln} одной масти — есть шанс на флеш.`;
        }
        if (hand.connected) {
            return `${hn}+${ln} подряд — есть шанс на стрит.`;
        }
        if (hand.high === 14) {
            return `Туз + ${ln} — туз даёт силу, но ${ln.toLowerCase()} — слабый кикер.`;
        }
        return `${hn} + ${ln} — обычная рука.`;
    }

    // ---- HAND STRENGTH SCORE (0-100) ----
    function handStrengthScore(hand) {
        let score = 0;
        if (hand.pair) {
            score = 50 + (hand.high - 2) * 3.5;
            if (hand.high === 14) score = 98;
            if (hand.high === 13) score = 95;
            if (hand.high === 12) score = 92;
            if (hand.high === 11) score = 88;
            if (hand.high === 10) score = 84;
        } else {
            score = (hand.high + hand.low) * 2;
            if (hand.suited) score += 8;
            if (hand.connected) score += 5;
            if (hand.oneGap) score += 2;
            if (hand.high === 14) score += 15;
            if (hand.high === 13) score += 10;
            if (hand.high === 12) score += 6;

            if (hand.name === 'AKs') score = 90;
            if (hand.name === 'AKo') score = 86;
            if (hand.name === 'AQs') score = 85;
            if (hand.name === 'AQo') score = 79;
            if (hand.name === 'AJs') score = 80;
            if (hand.name === 'ATs') score = 76;
            if (hand.name === 'KQs') score = 78;
            if (hand.name === 'KQo') score = 72;
            if (hand.name === 'KJs') score = 74;
            if (hand.name === 'KTs') score = 71;
            if (hand.name === 'QJs') score = 70;
            if (hand.name === 'QTs') score = 67;
            if (hand.name === 'JTs') score = 68;
            if (hand.name === 'T9s') score = 62;
            if (hand.name === '98s') score = 58;
            if (hand.name === '87s') score = 55;
            if (hand.name === '76s') score = 52;
            if (hand.name === '65s') score = 50;
        }
        return Math.min(100, Math.max(0, score));
    }

    function getHandCategory(score) {
        if (score >= 90) return { name: 'Премиум', emoji: '🔥', color: '#e74c3c' };
        if (score >= 78) return { name: 'Сильная', emoji: '💪', color: '#e67e22' };
        if (score >= 65) return { name: 'Хорошая', emoji: '👍', color: '#f1c40f' };
        if (score >= 50) return { name: 'Средняя', emoji: '🤔', color: '#3498db' };
        if (score >= 35) return { name: 'Слабая', emoji: '👎', color: '#95a5a6' };
        return { name: 'Мусор', emoji: '🗑️', color: '#636e72' };
    }

    // ---- PREFLOP RANGES ----
    const PREFLOP_RANGES = {
        'UTG':   { open: 78, call3bet: 85, fourbet: 92 },
        'UTG+1': { open: 74, call3bet: 82, fourbet: 91 },
        'MP':    { open: 68, call3bet: 78, fourbet: 90 },
        'MP+1':  { open: 64, call3bet: 75, fourbet: 89 },
        'HJ':    { open: 58, call3bet: 72, fourbet: 88 },
        'CO':    { open: 48, call3bet: 68, fourbet: 87 },
        'BTN':   { open: 38, call3bet: 62, fourbet: 85 },
        'SB':    { open: 52, call3bet: 70, fourbet: 88 },
        'BB':    { open: 0,  call3bet: 60, fourbet: 86 },
    };

    function adjustRangeForPlayers(threshold, playersLeft) {
        const adjustment = (8 - playersLeft) * 3;
        return Math.max(0, threshold - adjustment);
    }

    // ---- PREFLOP DECISION ----
    function preflopDecision(hand, position, actions, playersInHand) {
        const score = handStrengthScore(hand);
        const range = PREFLOP_RANGES[position] || PREFLOP_RANGES['MP'];
        const category = getHandCategory(score);
        const posInfo = POSITION_INFO[position] || POSITION_INFO['MP'];

        const hasRaise = actions.includes('raise');
        const has3Bet = actions.includes('3bet');
        const has4Bet = actions.includes('4bet');
        const hasAllIn = actions.includes('allin');
        const hasLimp = actions.includes('limp');
        const hasCall = actions.includes('call');
        const foldCount = actions.filter(a => a === 'fold').length;
        const playersLeft = Math.max(2, playersInHand - foldCount);

        let threshold, action, confidence;
        let mixStrategy = null;
        let tips = [];

        if (hasAllIn) {
            threshold = 90;
            if (score >= 95) {
                action = 'КОЛЛ'; confidence = 95;
                tips.push('У тебя суперсильная рука — коллируй олл-ин!');
            } else if (score >= threshold) {
                action = 'КОЛЛ'; confidence = 70;
                mixStrategy = { fold: 30, call: 70, raise: 0 };
                tips.push('Рука хорошая, но олл-ин опасен. Можно коллировать, но это риск.');
            } else if (score >= 85) {
                action = 'ФОЛД'; confidence = 65;
                mixStrategy = { fold: 70, call: 30, raise: 0 };
                tips.push('Против олл-ина нужна очень сильная рука. Лучше сбросить.');
            } else {
                action = 'ФОЛД'; confidence = 95;
                tips.push('Фолд. Против олл-ина играй только с лучшими картами (AA, KK, QQ, AK).');
            }
        } else if (has4Bet) {
            threshold = adjustRangeForPlayers(range.fourbet, playersLeft);
            if (score >= 95) {
                action = 'ОЛЛ-ИН'; confidence = 90;
                tips.push('Суперсильная рука vs 4-бет — пушим олл-ин!');
            } else if (score >= threshold) {
                action = 'КОЛЛ'; confidence = 75;
                mixStrategy = { fold: 20, call: 55, raise: 25 };
                tips.push('4-бет — серьёзная заявка. Твоя рука достаточно сильна для колла.');
            } else {
                action = 'ФОЛД'; confidence = 85;
                tips.push('4-бет обычно означает очень сильную руку у соперника. Сбрасывай.');
            }
        } else if (has3Bet) {
            threshold = adjustRangeForPlayers(range.call3bet, playersLeft);
            if (score >= 94) {
                action = '4-БЕТ'; confidence = 90;
                tips.push('У тебя монстр — делай 4-бет (повышай ещё раз)!');
            } else if (score >= threshold) {
                action = 'КОЛЛ'; confidence = 75;
                mixStrategy = { fold: 10, call: 60, raise: 30 };
                tips.push('Рука достаточно сильная чтобы коллировать 3-бет.');
            } else if (score >= threshold - 8) {
                action = 'ФОЛД'; confidence = 60;
                mixStrategy = { fold: 65, call: 25, raise: 10 };
                tips.push('На грани — чаще фолд, но иногда можно и коллировать.');
            } else {
                action = 'ФОЛД'; confidence = 85;
                tips.push('3-бет = кто-то заявляет силу. Твоя рука слишком слаба — фолд.');
            }
        } else if (hasRaise) {
            const callingThreshold = adjustRangeForPlayers(range.call3bet - 10, playersLeft);
            const reraisingThreshold = adjustRangeForPlayers(range.call3bet, playersLeft);
            if (score >= reraisingThreshold) {
                action = '3-БЕТ'; confidence = 85;
                mixStrategy = { fold: 0, call: 25, raise: 75 };
                tips.push('Сильная рука — повышай (3-бет) чтобы забрать пот или изолировать соперника.');
            } else if (score >= callingThreshold) {
                action = 'КОЛЛ'; confidence = 70;
                mixStrategy = { fold: 15, call: 65, raise: 20 };
                tips.push('Хорошая рука для колла чужого рейза.');
            } else if (score >= callingThreshold - 10 && hand.suited && (hand.connected || hand.oneGap)) {
                action = '3-БЕТ'; confidence = 50;
                mixStrategy = { fold: 50, call: 10, raise: 40 };
                tips.push('Рука слабовата, но одномастная и связанная — иногда можно 3-бетить как блеф.');
                tips.push('Это продвинутый приём. Если не уверен — просто фолд.');
            } else {
                action = 'ФОЛД'; confidence = 85;
                tips.push('Рука слишком слабая для колла рейза. Фолд.');
            }
        } else if (hasLimp || hasCall) {
            const isoThreshold = adjustRangeForPlayers(range.open - 10, playersLeft);
            if (score >= isoThreshold) {
                action = 'РЕЙЗ'; confidence = 80;
                tips.push('Кто-то лимпнул (зашёл за минимум) — рейзи чтобы "изолировать" его один на один.');
                tips.push('Лимперы обычно имеют слабые руки.');
            } else if (score >= isoThreshold - 15 && position === 'BB') {
                action = 'ЧЕК'; confidence = 70;
                tips.push('Ты на большом блайнде — можешь бесплатно посмотреть флоп. Чек.');
            } else {
                action = 'ФОЛД'; confidence = 75;
                tips.push('Не хватает силы для рейза по лимперам — фолд.');
            }
        } else {
            // RFI
            const openThreshold = adjustRangeForPlayers(range.open, playersLeft);
            if (score >= openThreshold) {
                action = 'РЕЙЗ'; confidence = 85;
                if (score >= openThreshold + 10) confidence = 92;
                tips.push('Никто до тебя не зашёл — открываемся рейзом!');
                if (posInfo.quality >= 4) {
                    tips.push('У тебя хорошая позиция — можно играть шире.');
                } else if (posInfo.quality <= 1) {
                    tips.push('Ранняя позиция — играем только сильные руки.');
                }
            } else if (score >= openThreshold - 5 && hand.suited && (hand.connected || hand.oneGap)) {
                action = 'РЕЙЗ'; confidence = 50;
                mixStrategy = { fold: 45, call: 0, raise: 55 };
                tips.push('На грани открытия. Одномастная связанная рука — иногда можно открыть.');
            } else {
                action = 'ФОЛД'; confidence = 85;
                tips.push('Рука не входит в диапазон открытия для этой позиции — фолд.');
                if (posInfo.quality <= 2) {
                    tips.push(`Из ${posInfo.short} играй только топ-руки: высокие пары, AK, AQ.`);
                }
            }
        }

        return {
            action, confidence, score, category, mixStrategy, tips,
            inRange: score >= (range.open || 0),
            position, positionInfo: posInfo, playersLeft
        };
    }

    // ---- BOARD TEXTURE ANALYSIS ----
    function analyzeBoardTexture(boardCards) {
        if (!boardCards || boardCards.length < 3) return null;

        const ranks = boardCards.map(c => RANK_VALUES[c[0]]);
        const suits = boardCards.map(c => c[1]);
        const sorted = [...ranks].sort((a, b) => a - b);
        const tags = [];
        const analysis = {};

        // Suit analysis
        const suitCounts = {};
        suits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
        const maxSuitCount = Math.max(...Object.values(suitCounts));

        if (maxSuitCount >= 3) {
            tags.push({ text: 'Монотон', class: 'monotone' });
            analysis.monotone = true;
        } else if (maxSuitCount === 2) {
            tags.push({ text: 'Двухтон', class: 'twotone' });
            analysis.twoTone = true;
        } else {
            tags.push({ text: 'Радуга', class: 'rainbow' });
            analysis.rainbow = true;
        }

        if (boardCards.length >= 4 && maxSuitCount >= 3) {
            tags.push({ text: 'Флеш возможен!', class: 'flush-possible' });
            analysis.flushPossible = true;
        }
        if (boardCards.length >= 5 && maxSuitCount >= 4) {
            analysis.flushComplete = true;
        }

        // Pair analysis
        const rankCounts = {};
        ranks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });
        const hasPair = Object.values(rankCounts).some(c => c >= 2);
        const hasTrips = Object.values(rankCounts).some(c => c >= 3);

        if (hasTrips) {
            tags.push({ text: 'Трипс на борде', class: 'paired' });
            analysis.trips = true;
        } else if (hasPair) {
            tags.push({ text: 'Пара на борде', class: 'paired' });
            analysis.paired = true;
        }

        // Connectivity
        const uniqueSorted = [...new Set(sorted)].sort((a, b) => a - b);
        if (uniqueSorted.includes(14)) uniqueSorted.unshift(1);

        const straightDraws = checkStraightDraws(uniqueSorted);
        let maxConnected = 1, currentRun = 1;
        for (let i = 1; i < uniqueSorted.length; i++) {
            if (uniqueSorted[i] - uniqueSorted[i-1] === 1) {
                currentRun++;
                maxConnected = Math.max(maxConnected, currentRun);
            } else if (uniqueSorted[i] - uniqueSorted[i-1] > 1) {
                currentRun = 1;
            }
        }

        if (maxConnected >= 3 || straightDraws.oesd) {
            tags.push({ text: 'Связанный', class: 'connected' });
            analysis.connected = true;
        }
        if (straightDraws.straightPossible) {
            tags.push({ text: 'Стрит возможен!', class: 'straight-possible' });
            analysis.straightPossible = true;
        }

        const highest = Math.max(...ranks);
        if (highest >= 12) {
            tags.push({ text: 'Высокий', class: 'high' });
            analysis.highBoard = true;
        } else if (highest <= 9) {
            tags.push({ text: 'Низкий', class: 'low' });
            analysis.lowBoard = true;
        }

        let wetness = 0;
        if (analysis.monotone) wetness += 35;
        else if (analysis.twoTone) wetness += 15;
        if (analysis.connected) wetness += 25;
        if (straightDraws.oesd) wetness += 15;
        if (straightDraws.gutshot) wetness += 8;
        if (analysis.highBoard) wetness += 5;
        if (hasPair) wetness -= 10;
        if (analysis.rainbow) wetness -= 5;
        wetness = Math.max(0, Math.min(100, wetness));

        if (wetness >= 50) {
            tags.push({ text: 'Мокрый борд', class: 'wet' });
        } else {
            tags.push({ text: 'Сухой борд', class: 'dry' });
        }

        analysis.wetness = wetness;
        analysis.tags = tags;
        analysis.highestCard = highest;
        analysis.lowestCard = Math.min(...ranks);
        analysis.straightDraws = straightDraws;
        analysis.flushDraw = maxSuitCount >= 2 && !analysis.flushComplete;

        return analysis;
    }

    function checkStraightDraws(sortedUniqueRanks) {
        let oesd = false, gutshot = false, straightPossible = false;
        for (let start = 1; start <= 10; start++) {
            let count = 0;
            for (let v = start; v < start + 5; v++) {
                if (sortedUniqueRanks.includes(v)) count++;
            }
            if (count >= 4) oesd = true;
            if (count >= 3) gutshot = true;
            if (count >= 5) straightPossible = true;
        }
        return { oesd, gutshot, straightPossible };
    }

    function describeBoardForBeginner(analysis) {
        if (!analysis) return '';
        const tips = [];
        if (analysis.wetness >= 60) {
            tips.push('Борд «мокрый» — много возможных дро (стритов, флешей). Будь осторожен, соперники могут дособирать комбинацию.');
        } else if (analysis.wetness <= 30) {
            tips.push('Борд «сухой» — мало дро. Тот, у кого сейчас сильнее, скорее всего и выиграет.');
        }
        if (analysis.monotone) tips.push('Три карты одной масти — у кого-то может быть флеш или флеш-дро!');
        if (analysis.paired) tips.push('На борде пара — у кого-то может быть фулл-хаус или тройка.');
        if (analysis.connected) tips.push('Карты на борде стоят подряд — много стрит-дро.');
        return tips.join(' ');
    }

    // ---- HAND + BOARD EVALUATION ----
    function evaluateHandOnBoard(card1, card2, boardCards) {
        if (!boardCards || boardCards.length < 3) return null;

        const allCards = [card1, card2, ...boardCards];
        const myRanks = [RANK_VALUES[card1[0]], RANK_VALUES[card2[0]]];
        const mySuits = [card1[1], card2[1]];
        const boardRanks = boardCards.map(c => RANK_VALUES[c[0]]);
        const boardSuits = boardCards.map(c => c[1]);
        const allRanks = allCards.map(c => RANK_VALUES[c[0]]);
        const allSuits = allCards.map(c => c[1]);

        const result = {
            madeHand: null, handRank: 0, draws: [], outs: 0,
            description: '', strengthLevel: 0, beginnerDesc: ''
        };

        const rankCounts = {};
        allRanks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });

        const suitCounts = {};
        allSuits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });

        // Check flush
        let hasFlush = false, flushSuit = null;
        for (const [suit, count] of Object.entries(suitCounts)) {
            if (count >= 5 && (mySuits[0] === suit || mySuits[1] === suit)) {
                hasFlush = true;
                flushSuit = suit;
            }
        }

        // Check straight
        const uniqueRanks = [...new Set(allRanks)].sort((a, b) => a - b);
        if (uniqueRanks.includes(14)) uniqueRanks.unshift(1);
        let hasStraight = false, straightHighCard = 0;
        for (let i = uniqueRanks.length - 1; i >= 4; i--) {
            let consecutive = true;
            for (let j = 0; j < 4; j++) {
                if (uniqueRanks[i] - uniqueRanks[i - j] !== j) { consecutive = false; break; }
            }
            if (consecutive) {
                const straightCards = [];
                for (let j = 0; j < 5; j++) straightCards.push(uniqueRanks[i] - j);
                if (straightCards.includes(myRanks[0]) || straightCards.includes(myRanks[1]) ||
                    (myRanks.includes(14) && straightCards.includes(1))) {
                    hasStraight = true;
                    straightHighCard = uniqueRanks[i];
                    break;
                }
            }
        }

        const quads = Object.entries(rankCounts).find(([r, c]) => c >= 4 && myRanks.includes(parseInt(r)));
        const myTrips = Object.entries(rankCounts).find(([r, c]) => c >= 3 && myRanks.includes(parseInt(r)));
        const anyPair = Object.entries(rankCounts).filter(([r, c]) => c >= 2);
        const trips = Object.entries(rankCounts).find(([r, c]) => c === 3 && myRanks.includes(parseInt(r)));
        const pairs = Object.entries(rankCounts).filter(([r, c]) => c >= 2 && myRanks.includes(parseInt(r)));
        const onePair = Object.entries(rankCounts).find(([r, c]) => c === 2 && myRanks.includes(parseInt(r)));
        const isSet = myRanks[0] === myRanks[1] && (rankCounts[myRanks[0]] || 0) >= 3;

        if (quads) {
            result.madeHand = 'Каре';
            result.handRank = 8; result.strengthLevel = 10;
            result.beginnerDesc = 'Каре! 4 одинаковых карты. Ты почти гарантированно выигрываешь — бери максимум фишек!';
        } else if (hasFlush && hasStraight) {
            result.madeHand = 'Стрит-флеш';
            result.handRank = 9; result.strengthLevel = 10;
            result.beginnerDesc = 'Стрит-флеш! Одна из лучших рук в покере — ставь всё!';
        } else if (myTrips && anyPair.length >= 2) {
            result.madeHand = 'Фулл-хаус';
            result.handRank = 7; result.strengthLevel = 9;
            result.beginnerDesc = 'Фулл-хаус! Тройка + пара. Очень сильная рука — играй агрессивно.';
        } else if (hasFlush) {
            result.madeHand = 'Флеш';
            result.handRank = 6;
            const myFlushCards = myRanks.filter((r, i) => mySuits[i] === flushSuit);
            if (myFlushCards.includes(14)) {
                result.strengthLevel = 9;
                result.description = 'Натсовый флеш';
                result.beginnerDesc = 'Натсовый флеш (с тузом)! Лучший возможный флеш — играй смело.';
            } else if (Math.max(...myFlushCards) >= 12) {
                result.strengthLevel = 8;
                result.description = 'Второй флеш';
                result.beginnerDesc = 'Сильный флеш, но не натсовый. Играй уверенно, но будь осторожен если кто-то пушит.';
            } else {
                result.strengthLevel = 7;
                result.description = 'Слабый флеш';
                result.beginnerDesc = 'Флеш есть, но низкий. У кого-то может быть флеш повыше — играй осторожнее.';
            }
        } else if (hasStraight) {
            result.madeHand = 'Стрит';
            result.handRank = 5; result.strengthLevel = 7;
            if (straightHighCard === 14) {
                result.description = 'Натсовый стрит';
                result.strengthLevel = 8;
                result.beginnerDesc = 'Самый высокий стрит! Сильная рука, но помни — флеш бьёт стрит.';
            } else {
                result.beginnerDesc = 'Стрит! 5 карт подряд. Хорошая рука, но осторожно если на борде одномастные карты (угроза флеша).';
            }
        } else if (isSet) {
            result.madeHand = 'Сет';
            result.handRank = 4; result.strengthLevel = 8;
            result.beginnerDesc = 'Сет! Твоя карманная пара попала в тройку. Скрытая сильная рука — противники не видят её. Играй агрессивно!';
        } else if (trips) {
            result.madeHand = 'Тройка';
            result.handRank = 4; result.strengthLevel = 7;
            result.beginnerDesc = 'Тройка (трипс). Сильная рука, но менее скрытая чем сет.';
        } else if (pairs.length >= 2) {
            result.madeHand = 'Две пары';
            result.handRank = 3;
            const pairVals = pairs.map(([r]) => parseInt(r)).sort((a, b) => b - a);
            if (pairVals[0] >= 12) {
                result.strengthLevel = 6;
                result.description = 'Топ две пары';
                result.beginnerDesc = 'Две сильных пары! Хорошая рука — но на мокром борде будь осторожен.';
            } else {
                result.strengthLevel = 5;
                result.beginnerDesc = 'Две пары. Неплохо, но уязвимо к стритам и флешам.';
            }
        } else if (onePair) {
            const pairRank = parseInt(onePair[0]);
            result.madeHand = 'Пара';
            result.handRank = 2;
            const sortedBoardRanks = [...boardRanks].sort((a, b) => b - a);
            if (myRanks[0] === myRanks[1] && pairRank > sortedBoardRanks[0]) {
                result.description = 'Оверпара';
                result.strengthLevel = 6;
                result.beginnerDesc = 'Оверпара — твоя пара выше всех карт на столе. Это сильно!';
            } else if (pairRank === sortedBoardRanks[0]) {
                const kicker = myRanks[0] === pairRank ? myRanks[1] : myRanks[0];
                if (kicker >= 12) {
                    result.description = 'Топ пара, топ кикер';
                    result.strengthLevel = 5;
                    result.beginnerDesc = 'Топ пара с хорошим кикером! Одна из лучших «одна пара» комбинаций.';
                } else if (kicker >= 9) {
                    result.description = 'Топ пара, средний кикер';
                    result.strengthLevel = 4;
                    result.beginnerDesc = 'Топ пара, но кикер средний. Играй аккуратно если кто-то рейзит.';
                } else {
                    result.description = 'Топ пара, слабый кикер';
                    result.strengthLevel = 3;
                    result.beginnerDesc = 'Попал в топ пару, но слабый кикер может проиграть другой топ паре.';
                }
            } else if (sortedBoardRanks.length >= 2 && pairRank === sortedBoardRanks[1]) {
                result.description = 'Средняя пара';
                result.strengthLevel = 3;
                result.beginnerDesc = 'Средняя пара — не худшая, но и не лучшая. Пот-контроль.';
            } else {
                result.description = 'Нижняя пара';
                result.strengthLevel = 2;
                result.beginnerDesc = 'Нижняя пара — слабая. Против бета обычно лучше фолд.';
            }
        } else {
            result.madeHand = 'Старшая карта';
            result.handRank = 1;
            const highCard = Math.max(...myRanks);
            if (highCard === 14) {
                result.description = 'Туз-хай';
                result.strengthLevel = 1;
                result.beginnerDesc = 'Ничего не попало, только туз-хай. Слабо — можно блефовать, но осторожно.';
            } else {
                result.description = '';
                result.strengthLevel = 0;
                result.beginnerDesc = 'Ни одна карта не совпала с бордом. Очень слабо — лучше чек/фолд.';
            }
        }

        // ---- DRAWS ----
        for (const [suit, count] of Object.entries(suitCounts)) {
            if (count === 4 && (mySuits[0] === suit || mySuits[1] === suit) && !hasFlush) {
                const myFlushRank = mySuits[0] === suit ? myRanks[0] : myRanks[1];
                if (myFlushRank === 14) {
                    result.draws.push('Натсовое флеш-дро (9 аутов)');
                } else {
                    result.draws.push('Флеш-дро (9 аутов)');
                }
                result.outs += 9;
            }
        }

        if (boardCards.length === 3 && !hasFlush) {
            for (const [suit, count] of Object.entries(suitCounts)) {
                if (count === 3 && mySuits.filter(s => s === suit).length >= 1) {
                    result.draws.push('Бэкдор флеш-дро');
                    result.outs += 1.5;
                }
            }
        }

        if (!hasStraight) {
            const myUniqueRanks = [...new Set([...allRanks])].sort((a, b) => a - b);
            if (myUniqueRanks.includes(14)) myUniqueRanks.unshift(1);
            let bestDraw = '';
            for (let start = 1; start <= 10; start++) {
                let count = 0, needsMyCard = false;
                for (let v = start; v < start + 5; v++) {
                    if (myUniqueRanks.includes(v)) {
                        count++;
                        if (myRanks.includes(v) || (v === 1 && myRanks.includes(14))) needsMyCard = true;
                    }
                }
                if (count === 4 && needsMyCard) {
                    const missing = [];
                    for (let v = start; v < start + 5; v++) {
                        if (!myUniqueRanks.includes(v)) missing.push(v);
                    }
                    if (missing[0] === start || missing[0] === start + 4) {
                        if (!bestDraw || bestDraw === 'gutshot') bestDraw = 'oesd';
                    } else {
                        if (!bestDraw) bestDraw = 'gutshot';
                    }
                }
            }
            if (bestDraw === 'oesd') {
                result.draws.push('Двусторонний стрит-дро (8 аутов)');
                result.outs += 8;
            } else if (bestDraw === 'gutshot') {
                result.draws.push('Гатшот стрит-дро (4 аута)');
                result.outs += 4;
            }
        }

        if (result.handRank <= 1) {
            const topBoard = Math.max(...boardRanks);
            const overcards = myRanks.filter(r => r > topBoard).length;
            if (overcards === 2) {
                result.draws.push('2 оверкарты (6 аутов)');
                result.outs += 6;
            } else if (overcards === 1) {
                result.draws.push('1 оверкарта (3 аута)');
                result.outs += 3;
            }
        }

        // Equity
        let equity;
        if (boardCards.length === 3) equity = Math.min(95, result.outs * 4);
        else if (boardCards.length === 4) equity = Math.min(95, result.outs * 2.2);
        else equity = 0;

        const madeHandEquity = [0, 10, 35, 55, 70, 80, 85, 88, 92, 95, 98][result.strengthLevel] || 0;
        result.equity = Math.min(98, Math.max(madeHandEquity, madeHandEquity + equity * 0.5));

        return result;
    }

    // ---- POSTFLOP DECISION ----
    function postflopDecision(handEval, boardAnalysis, actions, position, potSize, betSize, playersLeft, street, isPreflopAggressor) {
        if (!handEval || !boardAnalysis) return null;

        const hasRaise = actions.includes('raise');
        const has3Bet = actions.includes('3bet');
        const hasAllIn = actions.includes('allin');

        // Were we the preflop aggressor? (important for c-bet strategy)
        const wasPreflopAggressor = isPreflopAggressor !== undefined ? isPreflopAggressor : false;

        const equity = handEval.equity;
        const strength = handEval.strengthLevel;
        const outs = handEval.outs;
        const wetness = boardAnalysis.wetness;
        const activePlayers = Math.max(2, playersLeft);
        const isHeadsUp = activePlayers <= 2;
        const isMultiway = activePlayers >= 3;
        const inPosition = ['CO', 'BTN'].includes(position);
        const earlyPos = ['UTG', 'UTG+1', 'MP'].includes(position);

        const potOdds = betSize > 0 ? betSize / (potSize + betSize) * 100 : 0;

        // Facing a postflop bet/raise? Use betSize as indicator
        const facingBet = betSize > 0;

        // Board characteristics
        const isDry = wetness < 30;
        const isWet = wetness >= 50;
        const hasDraws = handEval.draws.length > 0;
        const hasStrongDraw = outs >= 8; // flush draw or OESD
        const hasComboDraw = outs >= 12;  // flush + straight draw
        const hasNutDraw = handEval.draws.some(d => d.includes('Натс'));

        let action, confidence;
        let mixStrategy = null;
        let sizing = null;
        let tips = [];

        // ============ MONSTERS (strength >= 8): Sets+, Flushes, Full Houses ============
        if (strength >= 8) {
            if (facingBet) {
                if (hasAllIn) {
                    action = 'КОЛЛ'; confidence = 95;
                    tips.push('Монстр-рука vs олл-ин — однозначно коллируем!');
                } else {
                    action = 'РЕЙЗ'; confidence = 90;
                    sizing = { potPercent: 75 };
                    tips.push('Очень сильная рука — рейзи для максимального вэлью.');
                    if (isWet) tips.push('На мокром борде рейз ещё важнее — не давай дро дешёвую карту.');
                }
            } else {
                // No bet facing us
                if (!inPosition && isHeadsUp) {
                    // Out of position — check-raise trap
                    action = 'ЧЕК'; confidence = 80;
                    mixStrategy = { fold: 0, call: 0, raise: 100 };
                    tips.push('Ловушка! Чек, а когда соперник поставит — рейз (чек-рейз).');
                    tips.push('Из ранней позиции чек-рейз с монстром собирает больше фишек.');
                } else {
                    action = 'БЕТ'; confidence = 88;
                    sizing = { potPercent: isWet ? 75 : 50 };
                    tips.push('Сильная рука в позиции — ставь и набирай банк.');
                }
            }
        }
        // ============ STRONG (strength 6-7): Two pair, overpair, trips, straights ============
        else if (strength >= 6) {
            if (facingBet) {
                if (hasAllIn) {
                    if (equity >= 55) {
                        action = 'КОЛЛ'; confidence = 70;
                        tips.push('Сильная рука vs олл-ин. Эквити хватает — коллируем.');
                    } else {
                        action = 'ФОЛД'; confidence = 60;
                        tips.push('Рука хорошая, но против олл-ина на этом борде рискованно.');
                    }
                } else {
                    action = 'КОЛЛ'; confidence = 78;
                    mixStrategy = { fold: 5, call: 55, raise: 40 };
                    tips.push('Сильная рука — коллируем. Иногда рейз для вэлью.');
                    if (isWet) tips.push('Мокрый борд — можно рейзить для защиты от дро.');
                }
            } else {
                // We should almost always bet with strong hands
                action = 'БЕТ'; confidence = 82;
                if (isWet) {
                    sizing = { potPercent: 67 };
                    tips.push('Мокрый борд — ставь ⅔ пота чтобы защититься от дро.');
                } else if (isDry) {
                    sizing = { potPercent: 33 };
                    tips.push('Сухой борд — маленький бет ⅓ пота. Мало что может измениться.');
                } else {
                    sizing = { potPercent: 50 };
                    tips.push('Сильная рука — ставим ½ пота для вэлью.');
                }
                if (wasPreflopAggressor) tips.push('Ты рейзил префлоп — продолжай давить (конт-бет).');
            }
        }
        // ============ MEDIUM (strength 4-5): Top pair good kicker, TPTK ============
        else if (strength >= 4) {
            if (facingBet) {
                if (hasAllIn) {
                    action = 'ФОЛД'; confidence = 75;
                    tips.push('Средняя рука vs олл-ин — слишком рискованно. Фолд.');
                } else if (potOdds > 0 && equity > potOdds) {
                    action = 'КОЛЛ'; confidence = 68;
                    tips.push(`Шанс выиграть ${equity.toFixed(0)}%, а нужно ${potOdds.toFixed(0)}% — математически выгодно коллировать.`);
                } else if (hasDraws) {
                    action = 'КОЛЛ'; confidence = 60;
                    tips.push('Пара + дро — коллируем, есть шанс усилиться.');
                } else {
                    action = 'КОЛЛ'; confidence = 55;
                    mixStrategy = { fold: 35, call: 60, raise: 5 };
                    tips.push('Топ пара vs бет — обычно коллируем, но иногда фолд если борд опасный.');
                    if (isWet) tips.push('Мокрый борд делает топ пару уязвимой.');
                }
            } else {
                // No bet facing — we should usually bet
                if (wasPreflopAggressor) {
                    // C-bet with top pair — standard play
                    action = 'БЕТ'; confidence = 80;
                    sizing = { potPercent: isDry ? 33 : 55 };
                    tips.push('Конт-бет (продолженная ставка). Ты рейзил префлоп — продолжай рассказывать историю.');
                    if (isDry) tips.push('Сухой борд — маленький бет ⅓ пота достаточно.');
                } else if (inPosition) {
                    action = 'БЕТ'; confidence = 72;
                    sizing = { potPercent: isDry ? 33 : 50 };
                    tips.push('Хорошая пара в позиции — ставим для вэлью и защиты.');
                } else if (isHeadsUp) {
                    // Out of position heads-up — mix bet and check
                    action = 'БЕТ'; confidence = 60;
                    mixStrategy = { fold: 0, call: 40, raise: 60 };
                    sizing = { potPercent: 40 };
                    tips.push('Топ пара — ставим для вэлью, но иногда чек в ловушку.');
                } else {
                    // Multiway — be more careful
                    action = 'ЧЕК'; confidence = 62;
                    mixStrategy = { fold: 0, call: 55, raise: 45 };
                    tips.push('Много игроков — с топ парой лучше контролировать банк. Чек, коллируем бет.');
                }
            }
        }
        // ============ WEAK-MEDIUM (strength 3): Top pair weak kicker, middle pair ============
        else if (strength >= 3) {
            if (facingBet) {
                if (hasAllIn || has3Bet) {
                    action = 'ФОЛД'; confidence = 80;
                    tips.push('Средняя рука vs сильную агрессию — не стоит рисковать.');
                } else if (potOdds > 0 && equity > potOdds) {
                    action = 'КОЛЛ'; confidence = 60;
                    tips.push(`Пот-оддсы позволяют коллировать: эквити ${equity.toFixed(0)}% > нужно ${potOdds.toFixed(0)}%.`);
                } else if (hasDraws) {
                    action = 'КОЛЛ'; confidence = 55;
                    tips.push('Пара + дро — можно коллировать в надежде усилиться.');
                } else {
                    action = 'ФОЛД'; confidence = 62;
                    mixStrategy = { fold: 60, call: 40, raise: 0 };
                    tips.push('Слабая пара без дро vs бет — обычно фолд.');
                }
            } else {
                // No bet facing
                if (wasPreflopAggressor && isHeadsUp) {
                    // C-bet bluff range — even with medium hand
                    action = 'БЕТ'; confidence = 62;
                    sizing = { potPercent: 33 };
                    mixStrategy = { fold: 0, call: 40, raise: 60 };
                    tips.push('Конт-бет с средней рукой. Ты рейзил — соперник часто сбросит.');
                    if (isDry) tips.push('На сухом борде конт-бет работает особенно хорошо.');
                } else if (inPosition && isHeadsUp) {
                    action = 'БЕТ'; confidence = 58;
                    sizing = { potPercent: 33 };
                    tips.push('В позиции хедз-ап можно поставить маленький бет для вэлью/защиты.');
                } else if (street === 'river') {
                    // River with medium hand — check for showdown
                    action = 'ЧЕК'; confidence = 70;
                    tips.push('Ривер со средней рукой — чек и идём на вскрытие.');
                } else {
                    action = 'ЧЕК'; confidence = 65;
                    tips.push('Средняя рука — контролируем банк. Если поставят — решаем по ситуации.');
                }
            }
        }
        // ============ DRAWS without made hand (strength < 3, but has draws) ============
        else if (hasStrongDraw) {
            if (facingBet) {
                if (hasAllIn) {
                    if (hasComboDraw) {
                        action = 'КОЛЛ'; confidence = 60;
                        tips.push(`Комбо-дро с ${outs} аутами vs олл-ин — у нас хороший шанс добрать.`);
                    } else {
                        action = 'ФОЛД'; confidence = 65;
                        tips.push('Дро vs олл-ин — обычно не хватает оддсов.');
                    }
                } else if (hasComboDraw && street !== 'river') {
                    // Semi-bluff raise with combo draw
                    action = 'РЕЙЗ'; confidence = 65;
                    mixStrategy = { fold: 10, call: 35, raise: 55 };
                    sizing = { potPercent: 75 };
                    tips.push(`Комбо-дро (${outs} аутов)! Полу-блеф рейзом — соперник может сбросить, а если нет — у нас куча шансов добрать.`);
                } else if (potOdds > 0 && (equity > potOdds || (outs * (street === 'flop' ? 4 : 2.2)) > potOdds)) {
                    action = 'КОЛЛ'; confidence = 65;
                    tips.push(`${outs} аутов — математически выгодно коллировать. Каждый аут ≈ ${street === 'flop' ? '4' : '2'}% шанса.`);
                } else {
                    action = 'КОЛЛ'; confidence = 55;
                    mixStrategy = { fold: 40, call: 55, raise: 5 };
                    tips.push(`Дро с ${outs} аутами — пограничный колл. Иногда можно, иногда фолд.`);
                }
            } else {
                // No bet — semi-bluff!
                if (street === 'river') {
                    // River — draws missed
                    if (inPosition && isHeadsUp && outs === 0) {
                        action = 'БЕТ'; confidence = 40;
                        sizing = { potPercent: 50 };
                        tips.push('Дро не добрал, но можно блефнуть — соперник тоже может иметь ничего.');
                        mixStrategy = { fold: 0, call: 65, raise: 35 };
                    } else {
                        action = 'ЧЕК'; confidence = 75;
                        tips.push('Ривер — дро не добрал. Чек.');
                    }
                } else {
                    // Flop/Turn — semi-bluff bet
                    action = 'БЕТ'; confidence = 70;
                    if (hasComboDraw) {
                        sizing = { potPercent: 67 };
                        tips.push(`Полу-блеф! ${outs} аутов — ставим ⅔ пота. Если сбросят — забираем банк. Если коллируют — у нас куча шансов.`);
                    } else if (hasNutDraw) {
                        sizing = { potPercent: 55 };
                        tips.push('Натсовое дро — ставим как полу-блеф. Выигрываем и когда сбрасывают, и когда добираем.');
                    } else {
                        sizing = { potPercent: 45 };
                        tips.push(`Полу-блеф с ${outs} аутами. Давление + шанс добрать комбинацию.`);
                    }
                    if (wasPreflopAggressor) tips.push('Ты рейзил префлоп — полу-блеф выглядит естественно как конт-бет.');
                }
            }
        }
        // ============ WEAK DRAWS (4-7 outs) ============
        else if (hasDraws && outs >= 4) {
            if (facingBet) {
                const drawOdds = outs * (street === 'flop' ? 4 : 2.2);
                if (drawOdds > potOdds) {
                    action = 'КОЛЛ'; confidence = 58;
                    tips.push(`Слабое дро, но оддсы подходят: ${outs} аутов ≈ ${drawOdds.toFixed(0)}% > нужно ${potOdds.toFixed(0)}%.`);
                } else {
                    action = 'ФОЛД'; confidence = 60;
                    tips.push(`Дро с ${outs} аутами, но оддсы не в нашу пользу. Фолд.`);
                }
            } else {
                if (wasPreflopAggressor && isHeadsUp && street === 'flop') {
                    // C-bet bluff with weak draw
                    action = 'БЕТ'; confidence = 55;
                    sizing = { potPercent: 33 };
                    tips.push('Конт-бет блеф с дро — маленький бет, чтобы забрать или увидеть бесплатную карту.');
                } else if (inPosition && isHeadsUp) {
                    action = 'БЕТ'; confidence = 50;
                    sizing = { potPercent: 33 };
                    mixStrategy = { fold: 0, call: 50, raise: 50 };
                    tips.push('В позиции можно поставить с дро — маленький бет как полу-блеф.');
                } else {
                    action = 'ЧЕК'; confidence = 65;
                    tips.push('Слабое дро — бесплатная карта лучше. Чек.');
                }
            }
        }
        // ============ AIR (nothing) ============
        else {
            if (facingBet) {
                action = 'ФОЛД'; confidence = 90;
                tips.push('Ничего нет — фолд. Не трать фишки зря.');
            } else {
                // Can we bluff?
                if (wasPreflopAggressor && isHeadsUp && street === 'flop' && !isWet) {
                    // C-bet bluff on dry board heads-up
                    action = 'БЕТ'; confidence = 55;
                    sizing = { potPercent: 33 };
                    mixStrategy = { fold: 0, call: 55, raise: 45 };
                    tips.push('Конт-бет блеф на сухом борде! Ты рейзил — соперник часто сбросит.');
                    tips.push('Блеф работает потому что ты рассказываешь историю: «Я рейзил, у меня сильная рука».');
                } else if (inPosition && isHeadsUp && isDry) {
                    action = 'БЕТ'; confidence = 42;
                    sizing = { potPercent: 25 };
                    mixStrategy = { fold: 0, call: 60, raise: 40 };
                    tips.push('Маленький блеф в позиции на сухом борде — иногда заберёшь банк.');
                } else {
                    action = 'ЧЕК'; confidence = 85;
                    tips.push('Ничего нет — чек. Если поставят — фолд.');
                }
            }
        }

        // ============ STREET-SPECIFIC ADJUSTMENTS ============
        if (street === 'turn' && action === 'БЕТ' && !facingBet) {
            // Turn — decisions matter more, increase sizing slightly
            if (sizing && strength >= 4) {
                sizing.potPercent = Math.min(80, sizing.potPercent + 10);
            }
            if (strength < 3 && !hasStrongDraw && !wasPreflopAggressor) {
                // Don't barrel turn without a hand or draw (unless c-betting)
                action = 'ЧЕК'; confidence = 70;
                tips.length = 0;
                tips.push('Тёрн без руки и без дро — стоп на блефе. Чек.');
            }
        }

        if (street === 'river') {
            // River — no more cards to come, draws are dead
            if (action === 'БЕТ' && strength < 3 && outs > 0 && !hasStrongDraw) {
                // We had a draw that missed
                if (inPosition && isHeadsUp) {
                    // Can bluff river in position
                    confidence = Math.min(confidence, 45);
                    mixStrategy = { fold: 0, call: 65, raise: 35 };
                    tips.length = 0;
                    tips.push('Ривер-блеф — дро не зашёл, но можно поблефить в позиции.');
                } else {
                    action = 'ЧЕК'; confidence = 80;
                    tips.length = 0;
                    tips.push('Ривер — дро не добрал. Чек и сдаёмся если поставят.');
                }
            }
        }

        // ============ MULTIWAY ADJUSTMENTS ============
        if (isMultiway) {
            // Tighten up in multiway pots
            if (action === 'БЕТ' && strength < 4 && !hasStrongDraw) {
                action = 'ЧЕК';
                confidence = 65;
                tips.length = 0;
                tips.push('Много игроков в банке — со средней рукой лучше чек. Кто-то может иметь сильнее.');
            }
            if (action === 'БЕТ' && confidence < 55) {
                action = 'ЧЕК';
                tips.length = 0;
                tips.push('Не блефуй в мультипот (много игроков) — кто-то точно заколлирует.');
            }
        }

        return {
            action, confidence, equity, potOdds, mixStrategy, sizing, tips,
            madeHand: handEval.madeHand,
            madeHandDescription: handEval.description,
            beginnerDesc: handEval.beginnerDesc,
            draws: handEval.draws, outs: handEval.outs,
            strengthLevel: handEval.strengthLevel,
            boardAnalysis
        };
    }

    // ---- BET SIZING ----
    function getSizingRecommendation(boardAnalysis, handStrength, street, potSize) {
        const sizes = [];
        if (!boardAnalysis) return sizes;

        if (street === 'flop') {
            if (boardAnalysis.wetness >= 60) {
                sizes.push({ label: '⅔ пота', recommended: true, reason: 'Мокрый флоп — ставим побольше, не даём дешёвые карты' });
                sizes.push({ label: '¾ пота', recommended: false, reason: 'Ещё больше давления' });
                sizes.push({ label: '⅓ пота', recommended: false, reason: 'Маленький бет' });
            } else {
                sizes.push({ label: '⅓ пота', recommended: true, reason: 'Сухой флоп — маленького бета достаточно' });
                sizes.push({ label: '¼ пота', recommended: false, reason: 'Минимальный бет' });
                sizes.push({ label: '½ пота', recommended: false, reason: 'Стандартный бет' });
            }
        } else if (street === 'turn') {
            if (handStrength >= 7) {
                sizes.push({ label: '¾ пота', recommended: true, reason: 'Сильная рука — бери больше вэлью на тёрне' });
                sizes.push({ label: '½ пота', recommended: false, reason: 'Средний бет' });
            } else {
                sizes.push({ label: '½ пота', recommended: true, reason: 'Стандартный бет на тёрне' });
                sizes.push({ label: '⅓ пота', recommended: false, reason: 'Маленький бет' });
            }
        } else if (street === 'river') {
            if (handStrength >= 8) {
                sizes.push({ label: 'Полный пот', recommended: true, reason: 'Натс! Бери максимум' });
                sizes.push({ label: '¾ пота', recommended: false, reason: 'Вэлью бет' });
            } else if (handStrength >= 5) {
                sizes.push({ label: '½ пота', recommended: true, reason: 'Тонкий вэлью — не переборщи' });
                sizes.push({ label: '⅓ пота', recommended: false, reason: 'Блок-бет (маленький бет чтобы контролировать)' });
            } else {
                sizes.push({ label: '¾ пота', recommended: true, reason: 'Блеф должен выглядеть убедительно' });
            }
        }
        return sizes;
    }

    // ---- RANGE GRID ----
    function generateRangeGrid(position, scenario) {
        const grid = [];
        const range = PREFLOP_RANGES[position] || PREFLOP_RANGES['MP'];
        let threshold;
        switch(scenario) {
            case 'open': threshold = range.open; break;
            case '3bet': threshold = range.call3bet; break;
            case '4bet': threshold = range.fourbet; break;
            default: threshold = range.open;
        }

        for (let i = 12; i >= 0; i--) {
            for (let j = 12; j >= 0; j--) {
                const r1 = RANKS[i], r2 = RANKS[j];
                let name, hand;
                if (i === j) {
                    name = r1 + r2;
                    hand = { pair: true, high: i+2, low: j+2, suited: false, connected: false, oneGap: false, twoGap: false, name };
                } else if (i > j) {
                    name = r1 + r2 + 's';
                    hand = { pair: false, high: i+2, low: j+2, suited: true, connected: Math.abs(i-j)===1, oneGap: Math.abs(i-j)===2, twoGap: Math.abs(i-j)===3, name };
                } else {
                    name = r2 + r1 + 'o';
                    hand = { pair: false, high: j+2, low: i+2, suited: false, connected: Math.abs(i-j)===1, oneGap: Math.abs(i-j)===2, twoGap: Math.abs(i-j)===3, name };
                }
                const score = handStrengthScore(hand);
                let status = 'out';
                if (score >= threshold) status = 'in';
                else if (score >= threshold - 6) status = 'marginal';
                grid.push({ name, status, score });
            }
        }
        return grid;
    }

    // ---- AUTO POT ESTIMATION ----
    function estimatePot(actions, blindSize, playersInHand, ante) {
        const anteTotal = (ante || 0) * playersInHand;
        let pot = blindSize * 1.5 + anteTotal; // SB + BB + antes
        let currentBet = blindSize;
        let raises = 0;

        for (const a of actions) {
            switch(a) {
                case 'fold': break;
                case 'limp': pot += currentBet; break;
                case 'call': pot += currentBet; break;
                case 'raise':
                    raises++;
                    currentBet = currentBet * 2.5 + (raises > 1 ? currentBet : 0);
                    pot += currentBet;
                    break;
                case '3bet':
                    currentBet = currentBet * 3;
                    pot += currentBet;
                    break;
                case '4bet':
                    currentBet = currentBet * 2.5;
                    pot += currentBet;
                    break;
                case 'allin':
                    pot += currentBet * 10;
                    currentBet = currentBet * 10;
                    break;
            }
        }
        return { pot: Math.round(pot), currentBet: Math.round(currentBet) };
    }

    // ================================================================
    // TOURNAMENT ENGINE
    // M-ratio, push/fold, ICM, phase awareness
    // ================================================================

    // M-ratio = stack / (SB + BB + antes)
    function calculateM(stack, blindSize, playersAtTable, ante) {
        const sb = blindSize * 0.5;
        const bb = blindSize;
        const totalAntes = (ante || 0) * playersAtTable;
        const orbCost = sb + bb + totalAntes;
        if (orbCost <= 0) return 999;
        return stack / orbCost;
    }

    // Effective M adjusts for fewer players (short-handed table)
    function effectiveM(m, playersAtTable) {
        return m * (playersAtTable / 10);
    }

    // M-Zone classification (Dan Harrington system)
    function getMZone(m) {
        if (m > 20)  return { zone: 'green',  name: 'Зелёная', color: '#2ecc71', emoji: '🟢',
            desc: 'Комфортная зона — играй нормальную стратегию, можно маневрировать.',
            tip: 'У тебя достаточно фишек для любого хода. Играй стандартную GTO-стратегию.' };
        if (m > 10)  return { zone: 'yellow', name: 'Жёлтая',  color: '#f1c40f', emoji: '🟡',
            desc: 'Стек сокращается — играй плотнее, выбирай моменты для агрессии.',
            tip: 'Не лимпуй! Только рейз или фолд. Ищи хорошие споты для пуша. Избегай мелких банков.' };
        if (m > 5)   return { zone: 'orange', name: 'Оранжевая', color: '#e67e22', emoji: '🟠',
            desc: 'ОПАСНО — скоро push/fold. Нужно двигаться первым!',
            tip: 'Рейз олл-ин или фолд. Никаких минрейзов. Не жди идеальную руку — скоро блайнды тебя съедят.' };
        if (m > 1)   return { zone: 'red',    name: 'Красная',  color: '#e74c3c', emoji: '🔴',
            desc: 'КРИТИЧНО — только push или fold! Любая приличная рука = олл-ин.',
            tip: 'Ты в режиме push/fold. Смотри таблицу ниже. Пушь первым — не коллируй чужие рейзы без топ-рук.' };
        return { zone: 'dead', name: 'Мёртвая',  color: '#636e72', emoji: '💀',
            desc: 'Почти без фишек — пуш с любой картой при первой возможности.',
            tip: 'Ставь олл-ин при первом удобном случае. Даже 72o лучше чем быть съеденным блайндами.' };
    }

    // ---- PUSH/FOLD CHARTS ----
    // Returns true if hand is a push for given position and M-ratio
    function isPushHand(hand, position, m, playersLeft) {
        const score = handStrengthScore(hand);

        // M > 15: no push/fold needed
        if (m > 15) return null;

        // Thresholds: lower score = push with weaker hands
        // Position matters a lot in push/fold
        const posQuality = (POSITION_INFO[position] || {}).quality || 2;

        let threshold;

        if (m <= 3) {
            // Desperate: push very wide
            const baseThresh = { 1: 30, 2: 25, 3: 20, 4: 15, 5: 10 };
            threshold = baseThresh[posQuality] || 25;
            // Adjust for players left to act
            threshold += Math.max(0, (playersLeft - 3)) * 5;
        } else if (m <= 6) {
            // Short: push wide but not crazy
            const baseThresh = { 1: 55, 2: 50, 3: 42, 4: 35, 5: 28 };
            threshold = baseThresh[posQuality] || 45;
            threshold += Math.max(0, (playersLeft - 3)) * 4;
        } else if (m <= 10) {
            // Medium-short: selective pushes
            const baseThresh = { 1: 72, 2: 68, 3: 60, 4: 52, 5: 42 };
            threshold = baseThresh[posQuality] || 60;
            threshold += Math.max(0, (playersLeft - 3)) * 3;
        } else {
            // M 10-15: only push premium from bad positions
            const baseThresh = { 1: 82, 2: 78, 3: 72, 4: 65, 5: 55 };
            threshold = baseThresh[posQuality] || 72;
        }

        threshold = Math.max(0, Math.min(95, threshold));

        return {
            shouldPush: score >= threshold,
            threshold,
            score,
            isPushFoldMode: m <= 10
        };
    }

    // ---- TOURNAMENT PHASE ----
    function detectPhase(playersRemaining, totalPlayers, paidPlaces) {
        if (!totalPlayers || totalPlayers <= 0) return 'normal';
        const ratio = playersRemaining / totalPlayers;
        const nearBubble = paidPlaces > 0 && playersRemaining <= paidPlaces * 1.2 && playersRemaining > paidPlaces;
        const inMoney = paidPlaces > 0 && playersRemaining <= paidPlaces;
        const finalTable = playersRemaining <= 9;

        if (nearBubble) return 'bubble';
        if (finalTable && inMoney) return 'final_table';
        if (inMoney) return 'in_money';
        if (ratio > 0.7) return 'early';
        if (ratio > 0.4) return 'middle';
        return 'late';
    }

    const PHASE_INFO = {
        'early':       { name: 'Ранняя стадия', emoji: '🌅', color: '#2ecc71',
            tip: 'Играй тайтово, набирай фишки без риска. Не блефуй много — соперники коллируют всё. Цени свои фишки, их нельзя докупить.' },
        'middle':      { name: 'Средняя стадия', emoji: '☀️', color: '#f1c40f',
            tip: 'Блайнды растут — начинай воровать банки. Атакуй слабых игроков и короткие стеки. Не застревай со средними руками.' },
        'late':        { name: 'Поздняя стадия', emoji: '🌙', color: '#e67e22',
            tip: 'Блайнды огромные, много коротких стеков. Атакуй пассивных. Если у тебя большой стек — давли. Маленький — ищи пуш.' },
        'bubble':      { name: 'ПУЗЫРЬ!', emoji: '🫧', color: '#e74c3c',
            tip: 'На пузыре средние стеки играют очень тайтово! Большой стек — давление на всех. Средний — терпи, не рискуй. Маленький — пушь, пока тебя ждут фолды.' },
        'in_money':    { name: 'В призах', emoji: '💰', color: '#2ecc71',
            tip: 'Ты уже в деньгах! Теперь играй на максимальный результат. Можно раскрепоститься и атаковать.' },
        'final_table': { name: 'Финальный стол', emoji: '🏆', color: '#f39c12',
            tip: 'Финалка! Каждое место = больше денег. Давли средние стеки если ты чип-лидер. Если мало фишек — ищи дабл-ап.' },
        'normal':      { name: 'Турнир', emoji: '🎮', color: '#3498db',
            tip: 'Стандартная турнирная стратегия.' }
    };

    // ---- TOURNAMENT PREFLOP DECISION ----
    function tournamentPreflopDecision(hand, position, actions, playersInHand, tournamentInfo) {
        const { stack, blindSize, ante, playersRemaining, totalPlayers, paidPlaces } = tournamentInfo;

        const m = calculateM(stack, blindSize, playersInHand, ante);
        const mZone = getMZone(m);
        const phase = detectPhase(playersRemaining, totalPlayers, paidPlaces);
        const phaseInfo = PHASE_INFO[phase] || PHASE_INFO['normal'];
        const pushFold = isPushHand(hand, position, m, playersInHand);
        const score = handStrengthScore(hand);

        // If in push/fold mode and nobody raised yet
        const hasRaise = actions.includes('raise') || actions.includes('3bet') || actions.includes('4bet') || actions.includes('allin');

        if (pushFold && pushFold.isPushFoldMode && !hasRaise) {
            // PUSH/FOLD MODE
            const tips = [];
            let action, confidence;

            if (pushFold.shouldPush) {
                action = 'ОЛЛ-ИН';
                confidence = m <= 5 ? 90 : 75;
                tips.push(`M = ${m.toFixed(1)} — ты в режиме push/fold.`);
                tips.push('Твоя рука достаточно сильна для олл-ина с этой позиции.');
                if (m <= 3) tips.push('У тебя мало фишек — нужно рисковать СЕЙЧАС пока есть фолд-эквити.');
            } else {
                action = 'ФОЛД';
                confidence = 80;
                tips.push(`M = ${m.toFixed(1)} — режим push/fold.`);
                tips.push('Рука слишком слабая для пуша из этой позиции. Жди лучшего момента.');
                if (m <= 3) tips.push('Но не жди слишком долго — через пару кругов блайнды тебя съедят!');
            }

            // Bubble adjustment
            if (phase === 'bubble') {
                tips.push('⚠️ ПУЗЫРЬ! Средние стеки фолдят чаще — используй это для пуша.');
                if (!pushFold.shouldPush && score >= pushFold.threshold - 10) {
                    tips.push('На пузыре можно пушить чуть шире — противники боятся вылететь.');
                }
            }

            return {
                action, confidence, score, category: getHandCategory(score),
                mixStrategy: null, tips,
                inRange: pushFold.shouldPush,
                position, positionInfo: POSITION_INFO[position],
                playersLeft: playersInHand,
                m, mZone, phase, phaseInfo,
                isPushFold: true, pushFold
            };
        }

        // Not in push/fold — use standard decision but adjust for M and phase
        const baseDecision = preflopDecision(hand, position, actions, playersInHand);

        // Adjust tips based on tournament context
        const tips = [...baseDecision.tips];

        if (m <= 20) {
            tips.unshift(`M = ${m.toFixed(1)} (${mZone.name} зона) — ${mZone.tip}`);
        }

        if (phase === 'bubble') {
            if (baseDecision.action === 'РЕЙЗ' || baseDecision.action === '3-БЕТ') {
                tips.push('🫧 На пузыре агрессия ценнее — соперники часто фолдят чтобы дожить до призов.');
            }
            if (baseDecision.action === 'КОЛЛ') {
                tips.push('🫧 На пузыре осторожнее с коллами — лучше рейзить или фолдить.');
            }
        }

        if (phase === 'early') {
            if (score < 60 && baseDecision.action !== 'ФОЛД') {
                tips.push('🌅 Ранняя стадия — можно не рисковать с маргинальными руками. Фишки ценны.');
            }
        }

        // Stack-depth adjustments
        if (m > 10 && m <= 20) {
            // Yellow zone: tighten limps, prefer raise/fold
            if (baseDecision.action === 'КОЛЛ' && !hasRaise) {
                tips.push('🟡 Жёлтая зона — лучше рейз или фолд, не лимп. Сохраняй фолд-эквити.');
            }
        }

        return {
            ...baseDecision,
            tips,
            m, mZone, phase, phaseInfo,
            isPushFold: false, pushFold
        };
    }

    // ---- PUSH/FOLD RANGE TABLE for display ----
    function generatePushFoldGrid(position, m, playersLeft) {
        const grid = [];
        for (let i = 12; i >= 0; i--) {
            for (let j = 12; j >= 0; j--) {
                const r1 = RANKS[i], r2 = RANKS[j];
                let name, hand;
                if (i === j) {
                    name = r1 + r2;
                    hand = { pair: true, high: i+2, low: j+2, suited: false, connected: false, oneGap: false, twoGap: false, name };
                } else if (i > j) {
                    name = r1 + r2 + 's';
                    hand = { pair: false, high: i+2, low: j+2, suited: true, connected: Math.abs(i-j)===1, oneGap: Math.abs(i-j)===2, twoGap: false, name };
                } else {
                    name = r2 + r1 + 'o';
                    hand = { pair: false, high: j+2, low: i+2, suited: false, connected: Math.abs(i-j)===1, oneGap: Math.abs(i-j)===2, twoGap: false, name };
                }
                const pf = isPushHand(hand, position, m, playersLeft);
                let status = 'out';
                if (pf && pf.shouldPush) status = 'in';
                else if (pf) {
                    const s = handStrengthScore(hand);
                    if (s >= pf.threshold - 6) status = 'marginal';
                }
                grid.push({ name, status });
            }
        }
        return grid;
    }

    return {
        RANKS, SUITS, RANK_VALUES, POSITIONS_8MAX, POSITION_INFO,
        classifyHand, handStrengthScore, getHandCategory, getHandNickname,
        describeHandForBeginner, preflopDecision, analyzeBoardTexture,
        describeBoardForBeginner, evaluateHandOnBoard, postflopDecision,
        getSizingRecommendation, generateRangeGrid, estimatePot,
        // Tournament
        calculateM, effectiveM, getMZone, isPushHand,
        detectPhase, PHASE_INFO, tournamentPreflopDecision,
        generatePushFoldGrid
    };
})();
