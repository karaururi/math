// script.js の先頭など
console.log("script.js loaded."); // スクリプトがロードされたことを確認するためのログ

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

// 現在のステップを管理
let currentStep = 1;
let recognizedEquation = '';
let solutionChart = null; // グラフオブジェクトを保持する変数

// キャンバス設定
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let isDrawing = false;
let strokes = [];
let currentStroke = [];

// キャンバスサイズ設定
function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
}
resizeCanvas();

function goBackToDrawing() {
    showStep(1);
    updateWorkflowIndicator(1);
}

// 描画設定
ctx.strokeStyle = '#333';
ctx.lineWidth = 3;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

// マウスイベント
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// タッチイベント
canvas.addEventListener('touchstart', handleTouch);
canvas.addEventListener('touchmove', handleTouch);
canvas.addEventListener('touchend', stopDrawing);

function startDrawing(e) {
    isDrawing = true;
    currentStroke = [];
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentStroke.push({ x, y });
    ctx.beginPath();
    ctx.moveTo(x, y);
}

function draw(e) {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentStroke.push({ x, y });
    ctx.lineTo(x, y);
    ctx.stroke();
}

function stopDrawing() {
    if (!isDrawing) return;
    isDrawing = false;
    if (currentStroke.length > 0) {
        strokes.push([...currentStroke]);
        currentStroke = [];
    }
}

function handleTouch(e) {
    e.preventDefault();
    const touch = e.touches[0];
    const mouseEvent = new MouseEvent(
        e.type === 'touchstart' ? 'mousedown' :
        e.type === 'touchmove' ? 'mousemove' : 'mouseup',
        {
            clientX: touch.clientX,
            clientY: touch.clientY
        }
    );
    canvas.dispatchEvent(mouseEvent);
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes = [];
}

function undoStroke() {
    if (strokes.length > 0) {
        strokes.pop();
        redrawCanvas();
    }
}

function redrawCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    strokes.forEach(stroke => {
        if (stroke.length > 0) {
            ctx.beginPath();
            ctx.moveTo(stroke[0].x, stroke[0].y);
            stroke.forEach(point => {
                ctx.lineTo(point.x, point.y);
            });
            ctx.stroke();
        }
    });
}

function toggleApiKey() {
    const apiKeyInput = document.getElementById('apiKey');
    apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
}

function showStep(stepNumber) {
    document.querySelectorAll('.step-content').forEach(el => {
        el.classList.remove('active');
    });
    document.getElementById(`step${stepNumber}-content`).classList.add('active');
    updateWorkflowIndicator(stepNumber);
    currentStep = stepNumber;
}

function updateWorkflowIndicator(activeStep) {
    for (let i = 1; i <= 4; i++) {
        const indicator = document.getElementById(`step${i}-indicator`);
        indicator.classList.remove('active', 'completed');
        if (i < activeStep) {
            indicator.classList.add('completed');
        } else if (i === activeStep) {
            indicator.classList.add('active');
        }
    }
}

function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    if (elementId === 'solutionError') {
        document.getElementById('solutionLoading').style.display = 'none';
        document.getElementById('errorControls').style.display = 'block';
    }
}

function hideError(elementId) {
    document.getElementById(elementId).style.display = 'none';
    if (elementId === 'solutionError') {
        document.getElementById('errorControls').style.display = 'none';
    }
}

async function recognizeHandwriting() {
    const apiKey = document.getElementById('apiKey').value.trim();
    if (!apiKey) {
        alert('Gemini APIキーを入力してください');
        return;
    }
    if (strokes.length === 0) {
        alert('まず数式を描いてください');
        return;
    }

    showStep(2);
    document.getElementById('recognitionLoading').style.display = 'block';
    hideError('recognitionError');

    try {
        const imageData = canvas.toDataURL('image/png');
        const base64Image = imageData.split(',')[1];
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: "この手書きの数式を認識して、LaTeX形式で正確に出力してください。数式のみを返答してください。例: x^2 + 2x + 1 = 0"
                            },
                            {
                                inline_data: {
                                    mime_type: "image/png",
                                    data: base64Image
                                }
                            }
                        ]
                    }]
                })
            }
        );

        if (!response.ok) throw new Error(`API error: ${response.status}`);

        const result = await response.json();
        recognizedEquation = result.candidates[0].content.parts[0].text.trim();

        document.getElementById('recognitionLoading').style.display = 'none';
        showRecognitionResult(recognizedEquation);
        showStep(3);
    } catch (error) {
        console.error('Recognition error:', error);
        showError('recognitionError', `認識エラー: ${error.message}`);
        document.getElementById('recognitionLoading').style.display = 'none';
    }
}

function showRecognitionResult(equation) {
    document.getElementById('editableEquation').value = equation;
    updatePreview();
}

function updatePreview() {
    const equation = document.getElementById('editableEquation').value;
    const previewDiv = document.getElementById('equationPreview');
    const recognizedDiv = document.getElementById('recognizedDisplay');

    const containsLatex = equation.includes('$') || /\\[a-zA-Z]+/.test(equation);

    previewDiv.innerHTML = `<p>${equation}</p>`;
    recognizedDiv.innerHTML = `<p>${equation}</p>`;

    if (window.MathJax && containsLatex) {
        MathJax.typesetPromise([previewDiv, recognizedDiv]).catch((err) => {
            console.log('MathJax error:', err);
        });
    }
}

function proceedToSolution() {
    const equation = document.getElementById('editableEquation').value.trim();
    if (!equation) {
        alert('数式を入力してください');
        return;
    }

    recognizedEquation = equation;
    solveMathEquation();
}

function useDirectInput() {
    const input = document.getElementById('directInput').value.trim();
    if (!input) {
        alert("入力された問題が空です。");
        return;
    }
    recognizedEquation = input;
    showRecognitionResult(input);
    showStep(3);
}

// MathJaxの数式区切り文字を適切に処理するヘルパー関数
function formatEquation(eq) {
    const trimmed = eq.trim();
    // 既にMathJaxの区切り文字で囲まれているかチェック
    if ((trimmed.startsWith('$') && trimmed.endsWith('$')) || 
        (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) || 
        (trimmed.startsWith('$$') && trimmed.endsWith('$$')) ||
        (trimmed.startsWith('\\\[') && trimmed.endsWith('\\\]'))
    ) {
        return trimmed; // 既に囲まれている場合はそのまま返す
    }
    // 囲まれていない場合はインライン数式として扱う
    return `$${trimmed}$`; 
}

async function solveMathEquation() {
    const apiKey = document.getElementById('apiKey').value.trim();

    showStep(4);
    document.getElementById('solutionLoading').style.display = 'block';
    hideError('solutionError');

    try {
        const prompt = `以下の数学の問題文または数式を段階的に解いてください: ${recognizedEquation}\n\n次のJSON形式で、**ステップ数に制限なく**詳しく解法を説明してください：\n\n{\n  "steps": [\n    {\n      "step": "ステップ番号",\n      "description": "このステップで何をするかを簡潔に説明",\n      "equation": "この時点での数式または説明（LaTeX形式または文章）",\n      "supplement": "このステップで使った公式や、より詳細な補足説明。平易な言葉で解説してください。不要な場合は空文字列にしてください。"\n    }\n  ],\n  "finalAnswer": "これまでのステップを踏まえた総括的な結論（LaTeX形式や自然な日本語文章）",\n  "graphData": {\n    "isPlottable": true,\n    "type": "line",\n    "labels": ["-10", "-9", "...", "10"],\n    "datasets": [\n      {\n        "label": "y = x^2 - 4",\n        "data": [96, 77, "...", 96],\n        "borderColor": "rgba(102, 126, 234, 1)",\n        "backgroundColor": "rgba(102, 126, 234, 0.1)"\n      }\n    ]\n  }\n}\n\n注意:\n- **グラフについて**: 入力された数式がグラフ化可能（例: y=f(x)の形式）な場合のみ、"isPlottable": true とし、"graphData"に適切なデータを入れてください。描画不可能な場合は "isPlottable": false としてください。xの範囲は-10から10など、適切に設定してください。\n- **JSONの文字列内でバックスラッシュ \\ は必ず二重にエスケープしてください（\\\\ としてください）。**\n- 出力は純粋なJSON形式のみでお願いします。\n`;

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

        const result = await response.json();
        console.log("Gemini API response:", result);

        let content = result.candidates[0].content.parts[0].text;
        
        // JSON文字列をよりロバストに抽出する
        // ```json ... ``` の形式、または純粋なJSON文字列に対応
        let jsonString = content;
        const jsonBlockMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonBlockMatch && jsonBlockMatch[1]) {
            jsonString = jsonBlockMatch[1];
        } else {
            // コードブロックがない場合、最初の{から最後の}までを抽出
            const startIndex = content.indexOf('{');
            const endIndex = content.lastIndexOf('}');
            if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
                jsonString = content.substring(startIndex, endIndex + 1);
            } else {
                throw new Error("API応答から有効なJSONオブジェクトが見つかりませんでした。");
            }
        }

        let solutionData;
        try {
            solutionData = JSON.parse(jsonString);
        } catch (e) {
            console.error('パース失敗したJSON文字列:', jsonString);
            // エラー情報をサーバーにPOSTで送信
            fetch('/log-json-error', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    message: "JSON Parse Failed",
                    fullApiResponseContent: content,
                    extractedJsonString: jsonString,
                    error: e.message
                })
            }).catch(logError => console.error("Error sending log to server:", logError));

            // 画面にもエラーを表示
            showError('solutionError', `解法エラー: JSONの解析に失敗しました。詳細はサーバーログを確認してください。`);
            document.getElementById('solutionLoading').style.display = 'none';
            return; // エラーなのでここで処理を終了
        }

        // ステップ描画
        const solutionStepsDiv = document.getElementById('solutionSteps');
        solutionStepsDiv.innerHTML = "";

        solutionData.steps.forEach((step, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.classList.add('solution-step');
            if (step.supplement) {
                stepDiv.setAttribute('data-supplement', step.supplement);
                stepDiv.title = 'クリックして詳細を表示';
                stepDiv.onclick = () => showSupplement(`ステップ ${index + 1} の補足`, `<p>${step.supplement.replace(/\n/g, '<br>')}</p>`);
            }
            stepDiv.innerHTML = `\n                <div class="step-number-solution">${index + 1}</div>\n                <p>${step.description}</p>\n                <p><b>数式:</b> ${formatEquation(step.equation)}</p>\n            `;
            solutionStepsDiv.appendChild(stepDiv);
        });

        // 最終答え表示
        const finalAnswerDiv = document.getElementById('finalAnswer');
        finalAnswerDiv.innerHTML = `<p><b>最終的な答え:</b> $${solutionData.finalAnswer}$</p>`;

        // グラフ描画
        const graphContainer = document.getElementById('graphContainer');
        if (solutionChart) {
            solutionChart.destroy();
            solutionChart = null;
        }

        if (solutionData.graphData && solutionData.graphData.isPlottable) {
            graphContainer.style.display = 'block';
            const ctx = document.getElementById('solutionGraph').getContext('2d');
            solutionChart = new Chart(ctx, {
                type: solutionData.graphData.type || 'line',
                data: {
                    labels: solutionData.graphData.labels,
                    datasets: solutionData.graphData.datasets
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: false }
                    }
                }
            });
        } else {
            graphContainer.style.display = 'none';
        }

        MathJax.typesetPromise([solutionStepsDiv, finalAnswerDiv]);
        document.getElementById('solutionLoadingBox').style.display = 'none';
        document.getElementById('solutionResults').style.display = 'block';

    } catch (error) {
        console.error('Solution error:', error);
        // エラーをサーバーに送信してログに出力させる
        fetch(`/log_error?message=${encodeURIComponent(error.stack || error.message)}`).catch(e => console.error("Error logging failed:", e));
        // 画面にも詳細なエラーを表示する
        showError('solutionError', `解法エラー: ${error.stack || error.message}`);
        document.getElementById('solutionLoading').style.display = 'none';
    }
}

function startOver() {
    currentStep = 1;
    document.getElementById('solutionResults').style.display = 'none';
    document.getElementById('graphContainer').style.display = 'none';
    if (solutionChart) {
        solutionChart.destroy();
        solutionChart = null;
    }
    document.getElementById('editableEquation').value = '';
    recognizedEquation = '';
    clearCanvas();
    showStep(1);
    updateWorkflowIndicator(currentStep);
}

function goBackToEdit() {
    currentStep = 3;
    showStep(3);
    updateWorkflowIndicator(currentStep);

    // 次の計算のために、解法表示エリアをリセットします
    document.getElementById('solutionResults').style.display = 'none';
    document.getElementById('solutionLoadingBox').style.display = 'block';
}

// モーダル関連
const modal = document.getElementById('supplementModal');

function showSupplement(title, content) {
    document.getElementById('supplementTitle').textContent = title;
    document.getElementById('supplementBody').innerHTML = content;
    modal.style.display = 'flex';
    if (window.MathJax && MathJax.typesetPromise) {
        // DOMの更新が完了してからMathJaxを実行し、レンダリングを確実にします
        requestAnimationFrame(() => {
            MathJax.typesetPromise([document.getElementById('supplementBody')])
                .catch(err => console.error('Supplement MathJax Error:', err));
        });
    }
}

function closeModal() {
    modal.style.display = 'none';
}

window.onclick = function(event) {
    if (event.target == modal) {
        closeModal();
    }
}
