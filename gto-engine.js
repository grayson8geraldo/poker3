// ============================================================
// GTO POKER ENGINE - Texas Hold'em 8-max
// Implements GTO-based preflop ranges, postflop strategy,
// board texture analysis, equity estimation, and bet sizing
// ============================================================

const GTO = (() => {

    // ---- CONSTANTS ----
    const RANKS = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
    const SUITS = ['h','d','c','s'];
    const RANK_VALUES = {
        '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'T':10,'J':11,'Q':12,'K':13,'A':14
    };

    const POSITIONS_8MAX = ['UTG','UTG+1','MP','MP+1','HJ','CO','BTN','SB','BB'];

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
        if (pair) {
            name = h + l;
        } else if (suited) {
            name = h + l + 's';
        } else {
            name = h + l + 'o';
        }

        return { name, high, low, gap, suited, pair, connected, oneGap, twoGap, v1, v2 };
    }

    // ---- HAND STRENGTH SCORE (0-100 for ranking) ----
    function handStrengthScore(hand) {
        let score = 0;

        if (hand.pair) {
            score = 50 + (hand.high - 2) * 3.5;
            if (hand.high === 14) score = 98; // AA
            if (hand.high === 13) score = 95; // KK
            if (hand.high === 12) score = 92; // QQ
            if (hand.high === 11) score = 88; // JJ
            if (hand.high === 10) score = 84; // TT
        } else {
            score = (hand.high + hand.low) * 2;
            if (hand.suited) score += 8;
            if (hand.connected) score += 5;
            if (hand.oneGap) score += 2;
            if (hand.high === 14) score += 15;
            if (hand.high === 13) score += 10;
            if (hand.high === 12) score += 6;

            // Premium hands
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

    // ---- GTO PREFLOP RANGES by position (8-max) ----
    // Range percentage thresholds: higher score = tighter play needed
    const PREFLOP_RANGES = {
        // RFI (Raise First In) thresholds
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

    // Adjustment per number of active players remaining
    function adjustRangeForPlayers(threshold, playersLeft) {
        // Fewer players = wider range
        const adjustment = (8 - playersLeft) * 3;
        return Math.max(0, threshold - adjustment);
    }

    // ---- PREFLOP DECISION ----
    function preflopDecision(hand, position, actions, playersInHand) {
        const score = handStrengthScore(hand);
        const range = PREFLOP_RANGES[position] || PREFLOP_RANGES['MP'];

        const hasRaise = actions.includes('raise');
        const has3Bet = actions.includes('3bet');
        const has4Bet = actions.includes('4bet');
        const hasAllIn = actions.includes('allin');
        const hasLimp = actions.includes('limp');
        const foldCount = actions.filter(a => a === 'fold').length;
        const playersLeft = playersInHand - foldCount;

        let threshold, action, confidence;
        let mixStrategy = null;

        if (hasAllIn) {
            // Facing all-in: only premium
            threshold = 90;
            if (score >= 95) {
                action = 'CALL'; confidence = 95;
            } else if (score >= threshold) {
                action = 'CALL'; confidence = 70;
                mixStrategy = { fold: 30, call: 70, raise: 0 };
            } else if (score >= 85) {
                action = 'FOLD'; confidence = 65;
                mixStrategy = { fold: 70, call: 30, raise: 0 };
            } else {
                action = 'FOLD'; confidence = 95;
            }
        } else if (has4Bet) {
            // Facing 4-bet
            threshold = adjustRangeForPlayers(range.fourbet, playersLeft);
            if (score >= 95) {
                action = 'ALL-IN'; confidence = 90;
            } else if (score >= threshold) {
                action = 'CALL'; confidence = 75;
                mixStrategy = { fold: 20, call: 55, raise: 25 };
            } else if (score >= threshold - 5) {
                action = 'FOLD'; confidence = 60;
                mixStrategy = { fold: 65, call: 35, raise: 0 };
            } else {
                action = 'FOLD'; confidence = 90;
            }
        } else if (has3Bet) {
            // Facing 3-bet
            threshold = adjustRangeForPlayers(range.call3bet, playersLeft);
            if (score >= 94) {
                action = '4-BET'; confidence = 90;
            } else if (score >= threshold) {
                action = 'CALL'; confidence = 75;
                mixStrategy = { fold: 10, call: 60, raise: 30 };
            } else if (score >= threshold - 8) {
                action = 'FOLD'; confidence = 60;
                mixStrategy = { fold: 65, call: 25, raise: 10 };
            } else {
                action = 'FOLD'; confidence = 85;
            }
        } else if (hasRaise) {
            // Facing open raise
            const callingThreshold = adjustRangeForPlayers(range.call3bet - 10, playersLeft);
            const reraisingThreshold = adjustRangeForPlayers(range.call3bet, playersLeft);

            if (score >= reraisingThreshold) {
                action = '3-BET'; confidence = 85;
                mixStrategy = { fold: 0, call: 25, raise: 75 };
            } else if (score >= callingThreshold) {
                action = 'CALL'; confidence = 70;
                mixStrategy = { fold: 15, call: 65, raise: 20 };
            } else if (score >= callingThreshold - 10 && hand.suited) {
                // Suited connectors as 3-bet bluff candidates
                if (hand.connected || hand.oneGap) {
                    action = '3-BET'; confidence = 55;
                    mixStrategy = { fold: 50, call: 10, raise: 40 };
                } else {
                    action = 'FOLD'; confidence = 75;
                }
            } else {
                action = 'FOLD'; confidence = 85;
            }
        } else if (hasLimp) {
            // Facing limpers - raise wider for isolation
            const isoThreshold = adjustRangeForPlayers(range.open - 10, playersLeft);
            if (score >= isoThreshold) {
                action = 'RAISE'; confidence = 80;
            } else if (score >= isoThreshold - 15 && position === 'BB') {
                action = 'CHECK'; confidence = 70;
            } else {
                action = 'FOLD'; confidence = 75;
            }
        } else {
            // RFI (first to act)
            const openThreshold = adjustRangeForPlayers(range.open, playersLeft);
            if (score >= openThreshold) {
                action = 'RAISE'; confidence = 80;
                if (score >= openThreshold + 5) confidence = 90;
            } else if (score >= openThreshold - 5 && hand.suited && (hand.connected || hand.oneGap)) {
                action = 'RAISE'; confidence = 55;
                mixStrategy = { fold: 45, call: 0, raise: 55 };
            } else {
                action = 'FOLD'; confidence = 85;
            }
        }

        return {
            action,
            confidence,
            score,
            mixStrategy,
            inRange: score >= (range.open || 0),
            position,
            playersLeft
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

        if (boardCards.length >= 3) {
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
        }

        if (boardCards.length >= 4 && maxSuitCount >= 3) {
            tags.push({ text: 'Флеш возможен', class: 'flush-possible' });
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
        let maxConnected = 1;
        let currentRun = 1;
        const uniqueSorted = [...new Set(sorted)].sort((a, b) => a - b);
        // Add ace as 1 for wheel
        if (uniqueSorted.includes(14)) {
            uniqueSorted.unshift(1);
        }

        for (let i = 1; i < uniqueSorted.length; i++) {
            if (uniqueSorted[i] - uniqueSorted[i-1] === 1) {
                currentRun++;
                maxConnected = Math.max(maxConnected, currentRun);
            } else if (uniqueSorted[i] - uniqueSorted[i-1] > 1) {
                currentRun = 1;
            }
        }

        // Check for straight draws / made straights
        const straightPossible = checkStraightDraws(uniqueSorted);
        if (maxConnected >= 3 || straightPossible.oesd) {
            tags.push({ text: 'Связанный', class: 'connected' });
            analysis.connected = true;
        }
        if (straightPossible.straightPossible) {
            tags.push({ text: 'Стрит возможен', class: 'straight-possible' });
            analysis.straightPossible = true;
        }

        // High/Low
        const highest = Math.max(...ranks);
        const lowest = Math.min(...ranks);
        if (highest >= 12) {
            tags.push({ text: 'Высокий', class: 'high' });
            analysis.highBoard = true;
        } else if (highest <= 9) {
            tags.push({ text: 'Низкий', class: 'low' });
            analysis.lowBoard = true;
        }

        // Wet vs Dry score (0=dry, 100=wet)
        let wetness = 0;
        if (analysis.monotone) wetness += 35;
        else if (analysis.twoTone) wetness += 15;
        if (analysis.connected) wetness += 25;
        if (straightPossible.oesd) wetness += 15;
        if (straightPossible.gutshot) wetness += 8;
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
        analysis.lowestCard = lowest;
        analysis.straightDraws = straightPossible;
        analysis.flushDraw = maxSuitCount >= 2 && !analysis.flushComplete;

        return analysis;
    }

    function checkStraightDraws(sortedUniqueRanks) {
        let oesd = false;
        let gutshot = false;
        let straightPossible = false;

        // Check every window of 5 consecutive values
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
            madeHand: null,
            handRank: 0,
            draws: [],
            outs: 0,
            description: '',
            strengthLevel: 0 // 0-10
        };

        // Count all ranks
        const rankCounts = {};
        allRanks.forEach(r => { rankCounts[r] = (rankCounts[r] || 0) + 1; });

        const boardRankCounts = {};
        boardRanks.forEach(r => { boardRankCounts[r] = (boardRankCounts[r] || 0) + 1; });

        // Check flush
        const suitCounts = {};
        allSuits.forEach(s => { suitCounts[s] = (suitCounts[s] || 0) + 1; });
        const boardSuitCounts = {};
        boardSuits.forEach(s => { boardSuitCounts[s] = (boardSuitCounts[s] || 0) + 1; });

        let hasFlush = false;
        let flushSuit = null;
        for (const [suit, count] of Object.entries(suitCounts)) {
            if (count >= 5 && (mySuits[0] === suit || mySuits[1] === suit)) {
                hasFlush = true;
                flushSuit = suit;
            }
        }

        // Check straight
        const uniqueRanks = [...new Set(allRanks)].sort((a, b) => a - b);
        if (uniqueRanks.includes(14)) uniqueRanks.unshift(1); // wheel
        let hasStraight = false;
        let straightHighCard = 0;
        for (let i = uniqueRanks.length - 1; i >= 4; i--) {
            let consecutive = true;
            for (let j = 0; j < 4; j++) {
                if (uniqueRanks[i] - uniqueRanks[i - j] !== j) {
                    consecutive = false;
                    break;
                }
            }
            if (consecutive) {
                // Make sure at least one of our cards participates
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

        // Quads
        const quads = Object.entries(rankCounts).find(([r, c]) => c >= 4 && myRanks.includes(parseInt(r)));
        // Full house
        const myTrips = Object.entries(rankCounts).find(([r, c]) => c >= 3 && myRanks.includes(parseInt(r)));
        const anyPair = Object.entries(rankCounts).filter(([r, c]) => c >= 2);
        // Three of a kind
        const trips = Object.entries(rankCounts).find(([r, c]) => c === 3 && myRanks.includes(parseInt(r)));
        // Two pair
        const pairs = Object.entries(rankCounts).filter(([r, c]) => c >= 2 && myRanks.includes(parseInt(r)));
        // One pair
        const onePair = Object.entries(rankCounts).find(([r, c]) => c === 2 && myRanks.includes(parseInt(r)));

        // Set (pocket pair hit board)
        const isSet = myRanks[0] === myRanks[1] && (rankCounts[myRanks[0]] || 0) >= 3;

        // Determine made hand
        if (quads) {
            result.madeHand = 'Каре';
            result.handRank = 8;
            result.strengthLevel = 10;
        } else if (hasFlush && hasStraight) {
            // Straight flush check (simplified)
            result.madeHand = 'Стрит-флеш';
            result.handRank = 9;
            result.strengthLevel = 10;
        } else if (myTrips && anyPair.length >= 2) {
            result.madeHand = 'Фулл хаус';
            result.handRank = 7;
            result.strengthLevel = 9;
        } else if (hasFlush) {
            result.madeHand = 'Флеш';
            result.handRank = 6;
            // Nut flush check
            const myFlushCards = myRanks.filter((r, i) => mySuits[i] === flushSuit);
            if (myFlushCards.includes(14)) {
                result.strengthLevel = 9;
                result.description = 'Натсовый флеш';
            } else if (Math.max(...myFlushCards) >= 12) {
                result.strengthLevel = 8;
                result.description = 'Второй/третий флеш';
            } else {
                result.strengthLevel = 7;
                result.description = 'Слабый флеш';
            }
        } else if (hasStraight) {
            result.madeHand = 'Стрит';
            result.handRank = 5;
            result.strengthLevel = 7;
            if (straightHighCard === 14) {
                result.description = 'Натсовый стрит';
                result.strengthLevel = 8;
            }
        } else if (isSet) {
            result.madeHand = 'Сет';
            result.handRank = 4;
            result.strengthLevel = 8;
        } else if (trips) {
            result.madeHand = 'Тройка';
            result.handRank = 4;
            result.strengthLevel = 7;
        } else if (pairs.length >= 2) {
            result.madeHand = 'Две пары';
            result.handRank = 3;
            const pairVals = pairs.map(([r]) => parseInt(r)).sort((a, b) => b - a);
            if (pairVals[0] >= 12) {
                result.strengthLevel = 6;
                result.description = 'Топ две пары';
            } else {
                result.strengthLevel = 5;
            }
        } else if (onePair) {
            const pairRank = parseInt(onePair[0]);
            result.madeHand = 'Пара';
            result.handRank = 2;

            // Is it top pair, middle pair, bottom pair, or overpair/underpair?
            const sortedBoardRanks = [...boardRanks].sort((a, b) => b - a);
            if (myRanks[0] === myRanks[1] && pairRank > sortedBoardRanks[0]) {
                result.description = 'Оверпара';
                result.strengthLevel = 6;
            } else if (pairRank === sortedBoardRanks[0]) {
                // Top pair - check kicker
                const kicker = myRanks[0] === pairRank ? myRanks[1] : myRanks[0];
                if (kicker >= 12) {
                    result.description = 'Топ пара, топ кикер';
                    result.strengthLevel = 5;
                } else if (kicker >= 9) {
                    result.description = 'Топ пара, средний кикер';
                    result.strengthLevel = 4;
                } else {
                    result.description = 'Топ пара, слабый кикер';
                    result.strengthLevel = 3;
                }
            } else if (sortedBoardRanks.length >= 2 && pairRank === sortedBoardRanks[1]) {
                result.description = 'Средняя пара';
                result.strengthLevel = 3;
            } else if (pairRank === sortedBoardRanks[sortedBoardRanks.length - 1]) {
                result.description = 'Нижняя пара';
                result.strengthLevel = 2;
            } else {
                result.description = 'Пара';
                result.strengthLevel = 2;
            }
        } else {
            // High card
            result.madeHand = 'Старшая карта';
            result.handRank = 1;
            const highCard = Math.max(...myRanks);
            if (highCard === 14) {
                result.description = 'Туз-хай';
                result.strengthLevel = 1;
            } else if (highCard === 13) {
                result.description = 'Король-хай';
                result.strengthLevel = 1;
            } else {
                result.description = '';
                result.strengthLevel = 0;
            }
        }

        // ---- DRAWS ----
        // Flush draw
        for (const [suit, count] of Object.entries(suitCounts)) {
            if (count === 4 && (mySuits[0] === suit || mySuits[1] === suit) && !hasFlush) {
                result.draws.push('Флеш-дро');
                result.outs += 9;
                const myFlushRank = mySuits[0] === suit ? myRanks[0] : myRanks[1];
                if (myFlushRank === 14) {
                    result.draws[result.draws.length - 1] = 'Натсовое флеш-дро';
                }
            }
        }

        // Backdoor flush draw (flop only)
        if (boardCards.length === 3 && !hasFlush) {
            for (const [suit, count] of Object.entries(suitCounts)) {
                if (count === 3 && mySuits.filter(s => s === suit).length >= 1) {
                    result.draws.push('Бэкдор флеш-дро');
                    result.outs += 1.5;
                }
            }
        }

        // Straight draws
        if (!hasStraight) {
            const myUniqueRanks = [...new Set([...allRanks])].sort((a, b) => a - b);
            if (myUniqueRanks.includes(14)) myUniqueRanks.unshift(1);

            let bestDraw = '';
            for (let start = 1; start <= 10; start++) {
                let count = 0;
                let needsMyCard = false;
                for (let v = start; v < start + 5; v++) {
                    if (myUniqueRanks.includes(v)) {
                        count++;
                        if (myRanks.includes(v) || (v === 1 && myRanks.includes(14))) needsMyCard = true;
                    }
                }
                if (count === 4 && needsMyCard) {
                    // Check if OESD or gutshot
                    const missing = [];
                    for (let v = start; v < start + 5; v++) {
                        if (!myUniqueRanks.includes(v)) missing.push(v);
                    }
                    if (missing[0] === start || missing[0] === start + 4) {
                        if (!bestDraw || bestDraw === 'gutshot') {
                            bestDraw = 'oesd';
                        }
                    } else {
                        if (!bestDraw) bestDraw = 'gutshot';
                    }
                }
            }

            if (bestDraw === 'oesd') {
                result.draws.push('OESD (8 аутов)');
                result.outs += 8;
            } else if (bestDraw === 'gutshot') {
                result.draws.push('Гатшот (4 аута)');
                result.outs += 4;
            }
        }

        // Overcards
        if (result.handRank <= 1) {
            const topBoard = Math.max(...boardRanks);
            const overcards = myRanks.filter(r => r > topBoard).length;
            if (overcards === 2) {
                result.draws.push('Две оверкарты (6 аутов)');
                result.outs += 6;
            } else if (overcards === 1) {
                result.draws.push('Одна оверкарта (3 аута)');
                result.outs += 3;
            }
        }

        // Equity estimation (simplified)
        let equity;
        if (boardCards.length === 3) {
            // Flop: 2 cards to come
            equity = Math.min(95, result.outs * 4);
        } else if (boardCards.length === 4) {
            // Turn: 1 card to come
            equity = Math.min(95, result.outs * 2.2);
        } else {
            equity = 0;
        }

        // Add made hand equity
        const madeHandEquity = [0, 10, 35, 55, 70, 80, 85, 88, 92, 95, 98][result.strengthLevel] || 0;
        result.equity = Math.min(98, Math.max(madeHandEquity, madeHandEquity + equity * 0.5));

        return result;
    }

    // ---- POSTFLOP DECISION ENGINE ----
    function postflopDecision(handEval, boardAnalysis, actions, position, potSize, betSize, playersLeft) {
        if (!handEval || !boardAnalysis) return null;

        const hasRaise = actions.includes('raise');
        const has3Bet = actions.includes('3bet');
        const hasAllIn = actions.includes('allin');
        const foldCount = actions.filter(a => a === 'fold').length;
        const activePlayers = playersLeft - foldCount;

        const equity = handEval.equity;
        const strength = handEval.strengthLevel;
        const draws = handEval.draws;
        const outs = handEval.outs;
        const wetness = boardAnalysis.wetness;

        // Pot odds calculation
        const potOdds = betSize > 0 ? betSize / (potSize + betSize) * 100 : 0;
        const impliedOdds = potOdds > 0 ? potOdds * 0.75 : 0; // Rough implied odds adjustment

        // Position advantage
        const positionBonus = ['CO', 'BTN'].includes(position) ? 8 : position === 'SB' ? -5 : 0;

        // Aggression level facing
        let facingAggression = 0;
        if (hasAllIn) facingAggression = 4;
        else if (has3Bet) facingAggression = 3;
        else if (hasRaise) facingAggression = 2;
        else facingAggression = 1;

        let action, confidence;
        let mixStrategy = null;
        let sizing = null;
        let reasoning = [];

        // ---- MONSTER HANDS (strength 8-10) ----
        if (strength >= 8) {
            if (facingAggression >= 3) {
                action = 'ALL-IN';
                confidence = 95;
                reasoning.push('Монстр рука vs сильная агрессия — максимальный вэлью');
            } else if (facingAggression >= 2) {
                action = 'RAISE';
                confidence = 90;
                sizing = { type: 'raise', amount: '2.5-3x', potPercent: 75 };
                reasoning.push('Сильная рука — рейзим для вэлью');
            } else {
                // Check-raise or bet
                if (['SB', 'BB', 'UTG'].includes(position) && activePlayers > 1) {
                    action = 'CHECK-RAISE';
                    confidence = 80;
                    reasoning.push('Сильная рука OOP — чек-рейз для вэлью');
                    mixStrategy = { fold: 0, call: 20, raise: 80 };
                } else {
                    action = 'BET';
                    confidence = 85;
                    sizing = { type: 'bet', amount: '65-75% пота', potPercent: 70 };
                    reasoning.push('Сильная рука IP — бет для вэлью');
                }
            }
        }
        // ---- STRONG HANDS (strength 6-7) ----
        else if (strength >= 6) {
            const effectiveEquity = equity + positionBonus;

            if (facingAggression >= 3) {
                if (effectiveEquity >= 60) {
                    action = 'CALL';
                    confidence = 70;
                    reasoning.push('Сильная рука, но осторожно vs рейз — колл');
                } else {
                    action = 'FOLD';
                    confidence = 60;
                    mixStrategy = { fold: 55, call: 45, raise: 0 };
                    reasoning.push('Сильная рука, но плохая позиция vs агрессии');
                }
            } else if (facingAggression >= 2) {
                action = 'CALL';
                confidence = 75;
                mixStrategy = { fold: 10, call: 55, raise: 35 };
                reasoning.push('Коллируем бет / рейзим слабых оппонентов');
                if (wetness > 60) {
                    reasoning.push('Мокрый борд — возможен рейз для защиты');
                    mixStrategy.raise += 15;
                    mixStrategy.call -= 15;
                }
            } else {
                action = 'BET';
                confidence = 80;
                if (wetness >= 50) {
                    sizing = { type: 'bet', amount: '60-75% пота', potPercent: 67 };
                    reasoning.push('Мокрый борд — ставим побольше для защиты');
                } else {
                    sizing = { type: 'bet', amount: '33-50% пота', potPercent: 40 };
                    reasoning.push('Сухой борд — маленький бет для вэлью');
                }
            }
        }
        // ---- MEDIUM HANDS (strength 3-5) ----
        else if (strength >= 3) {
            if (facingAggression >= 3) {
                action = 'FOLD';
                confidence = 80;
                reasoning.push('Средняя рука vs сильная агрессия — фолд');
            } else if (facingAggression >= 2) {
                if (potOdds > 0 && equity > potOdds) {
                    action = 'CALL';
                    confidence = 65;
                    reasoning.push(`Пот-оддсы ${potOdds.toFixed(0)}% — наша эквити ${equity.toFixed(0)}% достаточна`);
                } else if (draws.length > 0 && (equity + impliedOdds) > potOdds) {
                    action = 'CALL';
                    confidence = 55;
                    reasoning.push('Имплайд-оддсы оправдывают колл с дро');
                } else {
                    action = 'FOLD';
                    confidence = 65;
                    mixStrategy = { fold: 60, call: 40, raise: 0 };
                    reasoning.push('Пот-оддсы недостаточны');
                }
            } else {
                // No facing bet - decide to bet or check
                if (['BTN', 'CO'].includes(position) && activePlayers <= 2) {
                    action = 'BET';
                    confidence = 65;
                    sizing = { type: 'bet', amount: '25-40% пота', potPercent: 33 };
                    reasoning.push('Позиционный бет для тонкого вэлью / защиты');
                } else if (strength >= 4) {
                    action = 'BET';
                    confidence = 60;
                    sizing = { type: 'bet', amount: '33-50% пота', potPercent: 40 };
                    reasoning.push('Средняя сила — бет для вэлью / защиты');
                } else {
                    action = 'CHECK';
                    confidence = 70;
                    reasoning.push('Пот-контроль со средней рукой');
                    mixStrategy = { fold: 0, call: 70, raise: 30 };
                }
            }
        }
        // ---- DRAWS (strength < 3 but has draws) ----
        else if (draws.length > 0 && outs >= 6) {
            if (facingAggression >= 2) {
                if (equity > potOdds || (equity + 15) > potOdds) {
                    action = 'CALL';
                    confidence = 65;
                    reasoning.push(`Дро с ${outs} аутами — колл на пот-оддсах`);
                } else if (outs >= 12 && facingAggression <= 2) {
                    // Combo draw - semi-bluff raise
                    action = 'RAISE';
                    confidence = 60;
                    mixStrategy = { fold: 20, call: 30, raise: 50 };
                    reasoning.push('Комбо-дро — полублеф рейз');
                } else {
                    action = 'FOLD';
                    confidence = 55;
                    mixStrategy = { fold: 55, call: 45, raise: 0 };
                    reasoning.push('Недостаточно аутов / оддсов');
                }
            } else {
                // No facing bet - semi-bluff
                if (outs >= 8) {
                    action = 'BET';
                    confidence = 65;
                    sizing = { type: 'bet', amount: '55-70% пота', potPercent: 60 };
                    reasoning.push(`Полублеф с ${outs} аутами`);
                } else {
                    action = 'CHECK';
                    confidence = 60;
                    reasoning.push('Слабое дро — чек и бесплатная карта');
                }
            }
        }
        // ---- WEAK / NOTHING ----
        else {
            if (facingAggression >= 2) {
                action = 'FOLD';
                confidence = 90;
                reasoning.push('Нет руки, нет дро — фолд');
            } else {
                // Bluff opportunity?
                if (['BTN', 'CO'].includes(position) && activePlayers <= 2 && !boardAnalysis.connected && !boardAnalysis.flushPossible) {
                    action = 'BET';
                    confidence = 45;
                    sizing = { type: 'bet', amount: '25-33% пота', potPercent: 30 };
                    reasoning.push('Блеф на сухом борде в позиции');
                    mixStrategy = { fold: 0, call: 0, raise: 55 };
                    reasoning.push('Используем позицию для давления');
                } else if (position === 'BTN' && activePlayers <= 2) {
                    action = 'BET';
                    confidence = 40;
                    sizing = { type: 'bet', amount: '25-33% пота', potPercent: 30 };
                    mixStrategy = { fold: 0, call: 0, raise: 40 };
                    reasoning.push('Позиционный блеф с баттона');
                } else {
                    action = 'CHECK';
                    confidence = 85;
                    reasoning.push('Слабая рука — чек/фолд');
                }
            }
        }

        return {
            action,
            confidence,
            equity: equity,
            potOdds,
            mixStrategy,
            sizing,
            reasoning,
            madeHand: handEval.madeHand,
            madeHandDescription: handEval.description,
            draws: handEval.draws,
            outs: handEval.outs,
            strengthLevel: handEval.strengthLevel,
            boardAnalysis
        };
    }

    // ---- BET SIZING RECOMMENDATIONS ----
    function getSizingRecommendation(boardAnalysis, handStrength, street, potSize) {
        const sizes = [];

        if (!boardAnalysis) return sizes;

        if (street === 'flop') {
            if (boardAnalysis.wetness >= 60) {
                sizes.push({ size: '66%', label: '⅔ пота', recommended: true, reason: 'Мокрый флоп — защита от дро' });
                sizes.push({ size: '75%', label: '¾ пота', recommended: false, reason: 'Альтернатива для большего давления' });
                sizes.push({ size: '33%', label: '⅓ пота', recommended: false, reason: 'Маленький бет для поляризации' });
            } else {
                sizes.push({ size: '33%', label: '⅓ пота', recommended: true, reason: 'Сухой флоп — маленький бет' });
                sizes.push({ size: '25%', label: '¼ пота', recommended: false, reason: 'Мин-бет на сухом борде' });
                sizes.push({ size: '50%', label: '½ пота', recommended: false, reason: 'Стандартный размер' });
            }
        } else if (street === 'turn') {
            if (handStrength >= 7) {
                sizes.push({ size: '75%', label: '¾ пота', recommended: true, reason: 'Вэлью-бет на терне' });
                sizes.push({ size: '50%', label: '½ пота', recommended: false, reason: 'Средний сайзинг' });
            } else {
                sizes.push({ size: '50%', label: '½ пота', recommended: true, reason: 'Стандартный бет на терне' });
                sizes.push({ size: '33%', label: '⅓ пота', recommended: false, reason: 'Маленький бет' });
                sizes.push({ size: '75%', label: '¾ пота', recommended: false, reason: 'Большой бет для давления' });
            }
        } else if (street === 'river') {
            if (handStrength >= 8) {
                sizes.push({ size: '100%', label: 'Полный пот', recommended: true, reason: 'Макс вэлью с натсом' });
                sizes.push({ size: '125%', label: 'Овербет', recommended: false, reason: 'Поляризованный овербет' });
                sizes.push({ size: '75%', label: '¾ пота', recommended: false, reason: 'Стандартный вэлью-бет' });
            } else if (handStrength >= 5) {
                sizes.push({ size: '50%', label: '½ пота', recommended: true, reason: 'Тонкий вэлью-бет' });
                sizes.push({ size: '33%', label: '⅓ пота', recommended: false, reason: 'Блокбет' });
            } else {
                sizes.push({ size: '75%', label: '¾ пота', recommended: true, reason: 'Блеф-бет (поляризованно)' });
                sizes.push({ size: '125%', label: 'Овербет', recommended: false, reason: 'Поляризованный блеф' });
            }
        }

        return sizes;
    }

    // ---- GENERATE 13x13 RANGE GRID ----
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
                    hand = { pair: true, high: i + 2, low: j + 2, suited: false, connected: Math.abs(i - j) === 1, oneGap: Math.abs(i - j) === 2, twoGap: Math.abs(i - j) === 3, name };
                } else if (i > j) {
                    name = r1 + r2 + 's';
                    hand = { pair: false, high: i + 2, low: j + 2, suited: true, connected: Math.abs(i - j) === 1, oneGap: Math.abs(i - j) === 2, twoGap: Math.abs(i - j) === 3, name };
                } else {
                    name = r2 + r1 + 'o';
                    hand = { pair: false, high: j + 2, low: i + 2, suited: false, connected: Math.abs(i - j) === 1, oneGap: Math.abs(i - j) === 2, twoGap: Math.abs(i - j) === 3, name };
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

    // ---- PUBLIC API ----
    return {
        RANKS,
        SUITS,
        RANK_VALUES,
        POSITIONS_8MAX,
        classifyHand,
        handStrengthScore,
        preflopDecision,
        analyzeBoardTexture,
        evaluateHandOnBoard,
        postflopDecision,
        getSizingRecommendation,
        generateRangeGrid
    };
})();
