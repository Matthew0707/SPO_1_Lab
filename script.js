const KEYWORD_OPERATORS = new Set([
    "and", "or", "not", "in", "is",
    "if", "elif", "else", "for", "while", "break", "continue", "return",
    "def", "class", "try", "except", "finally", "raise", "with", "as",
    "import", "from", "lambda", "yield", "assert", "del", "global", "nonlocal",
    "pass", "async", "await", "match", "case"
]);

const CONSTANTS = new Set(["True", "False", "None", "NotImplemented", "Ellipsis"]);

const SYMBOLS = [
    "//=", "**=", ">>=", "<<=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=",
    "==", "!=", "<=", ">=", "//", "**", "<<", ">>", "->",
    "+", "-", "*", "/", "%", "<", ">", "=", "&", "|", "^", "~", "@",
    ".", ",", ";", ":", "(", ")", "[", "]", "{", "}"
];

const IGNORED_WORD_CHARS = new Set([" ", "\t", "\r", "\n"]);

function isIdentifierStart(ch) {
    return /[A-Za-z_]/.test(ch);
}

function isIdentifierPart(ch) {
    return /[A-Za-z0-9_]/.test(ch);
}

function readString(code, start) {
    const quote = code[start];
    const triple = code.slice(start, start + 3) === quote.repeat(3);
    const delimiter = triple ? quote.repeat(3) : quote;
    let i = start + delimiter.length;

    while (i < code.length) {
        if (code[i] === "\\") {
            i += 2;
            continue;
        }
        if (code.slice(i, i + delimiter.length) === delimiter) {
            return { value: code.slice(start, i + delimiter.length), end: i + delimiter.length };
        }
        i += 1;
    }

    throw new Error("Незавершённая строковая константа");
}

function readNumber(code, start) {
    const match = code.slice(start).match(/^(?:0[xX][0-9a-fA-F]+|0[bB][01]+|0[oO][0-7]+|(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?j?)/);
    if (!match) return null;
    return { value: match[0], end: start + match[0].length };
}

function tokenizePython(code) {
    const tokens = [];
    let i = 0;

    while (i < code.length) {
        const ch = code[i];

        if (IGNORED_WORD_CHARS.has(ch)) {
            i += 1;
            continue;
        }

        if (ch === "#") {
            while (i < code.length && code[i] !== "\n") i += 1;
            continue;
        }

        if (ch === '"' || ch === "'") {
            const item = readString(code, i);
            tokens.push({ type: "string", value: item.value });
            i = item.end;
            continue;
        }

        if (isIdentifierStart(ch)) {
            let end = i + 1;
            while (end < code.length && isIdentifierPart(code[end])) end += 1;
            tokens.push({ type: "name", value: code.slice(i, end) });
            i = end;
            continue;
        }

        const number = readNumber(code, i);
        if (number) {
            tokens.push({ type: "number", value: number.value });
            i = number.end;
            continue;
        }

        let matched = null;
        for (const symbol of SYMBOLS) {
            if (code.startsWith(symbol, i)) {
                matched = symbol;
                break;
            }
        }

        if (matched) {
            tokens.push({ type: "symbol", value: matched });
            i += matched.length;
            continue;
        }

        throw new Error(`Неизвестный символ: ${ch}`);
    }

    return tokens;
}


function nextToken(tokens, index) {
    return index + 1 < tokens.length ? tokens[index + 1] : null;
}

function analyzePython(code) {
    const tokens = tokenizePython(code);

    const operators = [];
    const operands = [];

    const declarationParens = new Set();

    for (let i = 0; i < tokens.length; i += 1) {
        const token = tokens[i];
        const value = token.value;

        if (token.type === "name") {
            const next = nextToken(tokens, i);

            if (value === "def") {
                operators.push("def");

                if (next && next.type === "name") {
                    operators.push(`${next.value}()`);

                    const openIndex = i + 2;

                    if (
                        openIndex < tokens.length &&
                        tokens[openIndex].value === "("
                    ) {
                        let depth = 0;

                        for (
                            let j = openIndex;
                            j < tokens.length;
                            j += 1
                        ) {
                            if (tokens[j].value === "(") {
                                depth += 1;

                                if (depth === 1) {
                                    declarationParens.add(j);
                                }
                            } else if (tokens[j].value === ")") {
                                if (depth === 1) {
                                    declarationParens.add(j);
                                    break;
                                }

                                depth -= 1;
                            }
                        }
                    }

                    i += 1;
                }

                continue;
            }

            if (value === "class") {
                operators.push("class");

                if (next && next.type === "name") {
                    operands.push(next.value);

                    const openIndex = i + 2;

                    if (
                        openIndex < tokens.length &&
                        tokens[openIndex].value === "("
                    ) {
                        let depth = 0;

                        for (
                            let j = openIndex;
                            j < tokens.length;
                            j += 1
                        ) {
                            if (tokens[j].value === "(") {
                                depth += 1;

                                if (depth === 1) {
                                    declarationParens.add(j);
                                }
                            } else if (tokens[j].value === ")") {
                                if (depth === 1) {
                                    declarationParens.add(j);
                                    break;
                                }

                                depth -= 1;
                            }
                        }
                    }

                    i += 1;
                }

                continue;
            }

            if (CONSTANTS.has(value)) {
                operands.push(value);
            } else if (
                next &&
                next.value === "(" &&
                !KEYWORD_OPERATORS.has(value)
            ) {
                operators.push(`${value}()`);
            } else if (KEYWORD_OPERATORS.has(value)) {
                if (value === "if" || value === "elif") {
                    operators.push("if/elif");
                } else if (
                    value === "is" &&
                    next &&
                    next.value === "not"
                ) {
                    operators.push("is not");
                    i += 1;
                } else if (
                    value === "not" &&
                    next &&
                    next.value === "in"
                ) {
                    operators.push("not in");
                    i += 1;
                } else {
                    operators.push(value);
                }
            } else {
                operands.push(value);
            }

            continue;
        }

        if (
            token.type === "string" ||
            token.type === "number"
        ) {
            operands.push(value);
            continue;
        }

        if (token.type === "symbol") {
            if (value === "(") {
                if (declarationParens.has(i)) {
                    continue;
                }

                const previous = i > 0 ? tokens[i - 1] : null;

                const isFunctionCall =
                    previous &&
                    previous.type === "name" &&
                    !KEYWORD_OPERATORS.has(previous.value);

                if (isFunctionCall) {
                    continue;
                }

                operators.push("()");
            } else if (value === "[") {
                operators.push("[]");
            } else if (value === "{") {
                operators.push("{}");
            } else if (value === ")") {
                if (declarationParens.has(i)) {
                    continue;
                }
            } else if (
                value !== "]" &&
                value !== "}"
            ) {
                operators.push(value);
            }
        }
    }

    const operatorFreq = new Map();
    const operandFreq = new Map();

    for (const item of operators) {
        operatorFreq.set(
            item,
            (operatorFreq.get(item) || 0) + 1
        );
    }

    for (const item of operands) {
        operandFreq.set(
            item,
            (operandFreq.get(item) || 0) + 1
        );
    }

    const eta1 = operatorFreq.size;
    const eta2 = operandFreq.size;

    const N1 = operators.length;
    const N2 = operands.length;

    const eta = eta1 + eta2;
    const N = N1 + N2;

    const V = eta > 0
        ? N * Math.log2(eta)
        : 0;

    return {
        eta1,
        eta2,
        N1,
        N2,
        eta,
        N,
        V,
        operatorFreq,
        operandFreq
    };
}

function sortedEntries(map) {
    return [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

function escapeHtml(text) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function fillTable(body, entries) {
    body.innerHTML = "";

    entries.forEach(([value, freq], index) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${index + 1}</td><td>${escapeHtml(value)}</td><td>${freq}</td>`;
        body.appendChild(tr);
    });
}

function clearResults() {
    ["eta1", "eta2", "N1", "N2", "eta", "N", "V"].forEach(id => {
        document.getElementById(id).textContent = "—";
    });

    document.getElementById("operatorsBody").innerHTML = "";
    document.getElementById("operandsBody").innerHTML = "";
    document.getElementById("status").textContent = "Результаты отсутствуют";
    document.getElementById("saveBtn").disabled = true;
    window.lastMetrics = null;
}

function showMetrics(metrics) {
    document.getElementById("eta1").textContent = metrics.eta1;
    document.getElementById("eta2").textContent = metrics.eta2;
    document.getElementById("N1").textContent = metrics.N1;
    document.getElementById("N2").textContent = metrics.N2;
    document.getElementById("eta").textContent = metrics.eta;
    document.getElementById("N").textContent = metrics.N;
    document.getElementById("V").textContent = metrics.V.toFixed(3);

    fillTable(document.getElementById("operatorsBody"), sortedEntries(metrics.operatorFreq));
    fillTable(document.getElementById("operandsBody"), sortedEntries(metrics.operandFreq));

    document.getElementById("saveBtn").disabled = false;
}

function analyzeCurrentCode() {
    const code = document.getElementById("codeInput").value;
    const status = document.getElementById("status");

    if (!code.trim()) {
        clearResults();
        status.textContent = "Нет кода для анализа";
        return;
    }

    try {
        const metrics = analyzePython(code);
        showMetrics(metrics);
        window.lastMetrics = metrics;
        status.textContent = `Анализ выполнен: ${metrics.N} элементов`;
    } catch (error) {
        clearResults();
        status.textContent = "Ошибка анализа";
        alert(error.message);
    }
}

function saveCsv() {
    const metrics = window.lastMetrics;

    if (!metrics) {
        alert("Сначала выполните анализ.");
        return;
    }


    // j | Оператор | f1j | i | Операнд | f2i
    const operators = sortedEntries(metrics.operatorFreq);
    const operands = sortedEntries(metrics.operandFreq);
    const rowCount = Math.max(operators.length, operands.length);
    const rows = [["j", "Оператор", "f1j", "i", "Операнд", "f2i"]];

    for (let index = 0; index < rowCount; index += 1) {
        const op = operators[index];
        const operand = operands[index];

        rows.push([
            op ? index + 1 : "",
            op ? op[0] : "",
            op ? op[1] : "",
            operand ? index + 1 : "",
            operand ? operand[0] : "",
            operand ? operand[1] : ""
        ]);
    }

    rows.push([]);
    rows.push(["Показатель", "Значение", "", "Показатель", "Значение", ""]);
    rows.push(["η1", metrics.eta1, "", "η2", metrics.eta2, ""]);
    rows.push(["N1", metrics.N1, "", "N2", metrics.N2, ""]);
    rows.push(["η", metrics.eta, "", "N", metrics.N, ""]);
    rows.push(["V", metrics.V.toFixed(3), "", "", "", ""]);

    const csv = rows.map(row => row.map(value => {
        const text = String(value ?? "");
        return /[;,"\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
    }).join(";")).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "halstead_result.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    document.getElementById("status").textContent = "CSV сохранён";
}

const fileInput = document.getElementById("fileInput");
const codeInput = document.getElementById("codeInput");

// При открытии страницы всё пусто. Никакой автоматической загрузки или анализа.
clearResults();

document.getElementById("openBtn").addEventListener("click", () => {
    fileInput.click();
});

document.getElementById("analyzeBtn").addEventListener("click", analyzeCurrentCode);

document.getElementById("clearBtn").addEventListener("click", () => {
    codeInput.value = "";
    clearResults();
    document.getElementById("status").textContent = "Очищено";
    fileInput.value = "";
});

document.getElementById("saveBtn").addEventListener("click", saveCsv);

fileInput.addEventListener("change", event => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
        codeInput.value = reader.result;
        clearResults();
        document.getElementById("status").textContent = `Загружен файл: ${file.name}.`;
    };

    reader.onerror = () => {
        codeInput.value = "";
        clearResults();
        document.getElementById("status").textContent = "Ошибка чтения файла";
        alert("Не удалось прочитать выбранный файл.");
    };

    reader.readAsText(file, "utf-8");
});
