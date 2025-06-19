// 現在のステップを管理
let currentStep = 1;
let recognizedEquation = '';

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

function goBackToDrawing() {
    showStep(1);
    updateWorkflowIndicator(1);
}

// キャンバスの初期化を改善
function initializeCanvas() {
    resizeCanvas();
    // キャンバスのタッチ操作を改善
    canvas.style.touchAction = 'none';
}

window.addEventListener('load', initializeCanvas);

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
}

function hideError(elementId) {
    document.getElementById(elementId).style.display = 'none';
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

    // LaTeXの簡易検出（$が含まれる or バックスラッシュで始まるコマンドがある）
    const containsLatex = equation.includes('$') || /\\[a-zA-Z]+/.test(equation);

    // innerHTMLをそのまま表示（MathJaxが処理する）
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

async function solveMathEquation() {
    const apiKey = document.getElementById('apiKey').value.trim();

    showStep(4);
    document.getElementById('solutionLoading').style.display = 'block';
    hideError('solutionError');

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `以下の数学の問題文または数式を段階的に解いてください: ${recognizedEquation}

次のJSON形式で、**ステップ数に制限なく**詳しく解法を説明してください：

{
  "steps": [
    {
      "step": ステップ番号,
      "description": "このステップで何をするかを説明",
      "equation": "この時点での数式または説明（LaTeX形式または文章）"
    }
  ],
  "finalAnswer": "これまでのステップを踏まえた総括的な結論（LaTeX形式や自然な日本語文章）"
}

注意:
- JSONの文字列内でバックスラッシュ \\ は必ず二重にエスケープしてください（\\\\ としてください）。
- 例： \\mathbb{R} は \\\\mathbb{R} としてください。
- 出力は純粋なJSON形式のみでお願いします。
`
                        }]
                    }]
                })
            });

        const result = await response.json();
        console.log("🟢 Gemini API response:", result);

        if (!response.ok) {
            throw new Error(`API エラー: ${response.status} ${response.statusText}`);
        }

        const content = result.candidates[0].content.parts[0].text;

        // JSON抽出処理を改良
        let jsonString = '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            jsonString = jsonMatch[0];
        } else {
            throw new Error('有効なJSONレスポンスが見つかりません');
        }

        let solutionData;
        try {
            solutionData = JSON.parse(jsonString);
        } catch (e) {
            console.error('パース失敗したJSON文字列:', jsonString);
            throw new Error("JSONの解析に失敗しました: " + e.message);
        }

        // データ形式の検証
        if (!solutionData.steps || !Array.isArray(solutionData.steps)) {
            throw new Error('解法ステップの形式が不正です');
        }

        // ステップ描画
        const solutionStepsDiv = document.getElementById('solutionSteps');
        solutionStepsDiv.innerHTML = ""; // 前回の結果をクリア

        solutionData.steps.forEach((step, index) => {
            const stepDiv = document.createElement('div');
            stepDiv.classList.add('solution-step');
            const equationText = step.equation || '';
            const descriptionText = step.description || `ステップ ${index + 1}`;
            stepDiv.innerHTML = `
                <div class="step-number-solution">${index + 1}</div>
                <p>${descriptionText}</p>
                ${equationText ? `<p><b>数式:</b> \\(${equationText}\\)</p>` : ''}
            `;
            solutionStepsDiv.appendChild(stepDiv);
        });

        // 結論表示
        const finalAnswerDiv = document.getElementById('finalAnswer');
        const finalAnswerText = solutionData.finalAnswer || '解答を取得できませんでした';
        finalAnswerDiv.innerHTML = `
            <p><b>最終的な答え:</b> \\(${finalAnswerText}\\)</p>
        `;

        // MathJaxの再レンダリング
        if (window.MathJax) {
            MathJax.typesetPromise([solutionStepsDiv, finalAnswerDiv]).catch((err) => {
                console.warn('MathJax レンダリングエラー:', err);
            });
        }

        document.getElementById('solutionLoadingBox').style.display = 'none';
        document.getElementById('solutionResults').style.display = 'block';

    } catch (error) {
        console.error('Solution error:', error);
        showError('solutionError', `解法エラー: ${error.message}`);
        document.getElementById('solutionLoading').style.display = 'none';
    }
}

function startOver() {
    currentStep = 1;
    document.getElementById('solutionResults').style.display = 'none';
    document.getElementById('editableEquation').value = '';
    recognizedEquation = '';
    showStep(1);
    updateWorkflowIndicator(currentStep);
}

function goBackToEdit() {
    currentStep = 3;
    showStep(3);
    updateWorkflowIndicator(currentStep);
}
