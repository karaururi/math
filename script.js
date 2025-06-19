// ==================== 初期設定・変数定義 ====================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(reg => console.log('Service Worker registered:', reg.scope))
      .catch(err => console.error('Service Worker registration failed:', err));
  });
}

let currentStep = 1;
let recognizedEquation = '';
let isDrawing = false;
let strokes = [];
let currentStroke = [];

// ==================== キャンバス設定 ====================
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width;
  canvas.height = rect.height;
}

function initializeCanvas() {
  resizeCanvas();
  canvas.style.touchAction = 'none';
}

window.addEventListener('load', initializeCanvas);

// ==================== 描画処理 ====================
ctx.strokeStyle = '#333';
ctx.lineWidth = 3;
ctx.lineCap = 'round';
ctx.lineJoin = 'round';

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

canvas.addEventListener('touchstart', handleTouch);
canvas.addEventListener('touchmove', handleTouch);
canvas.addEventListener('touchend', stopDrawing);

function startDrawing(e) {
  isDrawing = true;
  currentStroke = [];
  const { x, y } = getCanvasPos(e);
  currentStroke.push({ x, y });
  ctx.beginPath();
  ctx.moveTo(x, y);
}

function draw(e) {
  if (!isDrawing) return;
  const { x, y } = getCanvasPos(e);
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

function getCanvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
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
  for (const stroke of strokes) {
    if (stroke.length === 0) continue;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (const point of stroke) {
      ctx.lineTo(point.x, point.y);
    }
    ctx.stroke();
  }
}

// ==================== ワークフロー制御 ====================
function showStep(stepNumber) {
  document.querySelectorAll('.step-content').forEach(el => el.classList.remove('active'));
  document.getElementById(`step${stepNumber}-content`).classList.add('active');
  updateWorkflowIndicator(stepNumber);
  currentStep = stepNumber;
}

function updateWorkflowIndicator(activeStep) {
  for (let i = 1; i <= 4; i++) {
    const indicator = document.getElementById(`step${i}-indicator`);
    indicator.classList.remove('active', 'completed');
    if (i < activeStep) indicator.classList.add('completed');
    else if (i === activeStep) indicator.classList.add('active');
  }
}

function toggleApiKey() {
  const apiKeyInput = document.getElementById('apiKey');
  apiKeyInput.type = apiKeyInput.type === 'password' ? 'text' : 'password';
}

function showError(elementId, message) {
  const el = document.getElementById(elementId);
  el.textContent = message;
  el.style.display = 'block';
}

function hideError(elementId) {
  document.getElementById(elementId).style.display = 'none';
}

// ==================== 数式認識 ====================
async function recognizeHandwriting() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!apiKey) return alert('Gemini APIキーを入力してください');
  if (strokes.length === 0) return alert('まず数式を描いてください');

  showStep(2);
  document.getElementById('recognitionLoading').style.display = 'block';
  hideError('recognitionError');

  try {
    const base64Image = canvas.toDataURL('image/png').split(',')[1];
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "この手書きの数式を認識して、LaTeX形式で出力してください。数式のみを返答してください。" },
              { inline_data: { mime_type: "image/png", data: base64Image } }
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

  previewDiv.innerHTML = `<p>${equation}</p>`;
  recognizedDiv.innerHTML = `<p>${equation}</p>`;

  if (window.MathJax && (/\\[a-zA-Z]+/.test(equation) || equation.includes('$'))) {
    MathJax.typesetPromise([previewDiv, recognizedDiv]).catch(err => console.log('MathJax error:', err));
  }
}

// ==================== 数式解法 ====================
async function solveMathEquation() {
  const apiKey = document.getElementById('apiKey').value.trim();
  if (!recognizedEquation) return;

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
              text: `以下の数式を段階的に解いてください: ${recognizedEquation}

次のJSON形式で詳しく解説してください：

{
  "steps": [
    {
      "step": ステップ番号,
      "description": "説明",
      "equation": "LaTeX表現"
    }
  ],
  "finalAnswer": "LaTeXまたは自然な日本語での結論"
}

注意:
- バックスラッシュは \\\\ にエスケープしてください。
- 純粋なJSON形式のみを返してください。
`
            }]
          }]
        })
      }
    );

    const result = await response.json();
    const content = result.candidates[0].content.parts[0].text;
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('有効なJSONが見つかりません');

    const solutionData = JSON.parse(match[0]);
    displaySolutionSteps(solutionData.steps);
    displayFinalAnswer(solutionData.finalAnswer);

    document.getElementById('solutionLoading').style.display = 'none';
  } catch (error) {
    console.error('Solution error:', error);
    showError('solutionError', `解法エラー: ${error.message}`);
    document.getElementById('solutionLoading').style.display = 'none';
  }
}

function displaySolutionSteps(steps) {
  const stepsContainer = document.getElementById('solutionSteps');
  stepsContainer.innerHTML = ''; // 既存内容をクリア

  steps.forEach((stepObj, index) => {
    const stepDiv = document.createElement('div');
    stepDiv.className = 'solution-step';

    const stepText = document.createElement('p');
    stepText.textContent = `ステップ ${stepObj.step}: ${stepObj.description}`;

    const equation = document.createElement('p');
    equation.innerHTML = stepObj.equation;

    stepDiv.appendChild(stepText);
    stepDiv.appendChild(equation);
    stepsContainer.appendChild(stepDiv);
  });

  // MathJax再描画
  if (window.MathJax) {
    MathJax.typesetPromise([stepsContainer]).catch(err => console.error('MathJax error:', err));
  }
}

function displayFinalAnswer(answer) {
  const answerContainer = document.getElementById('finalAnswer');
  answerContainer.innerHTML = `<strong>最終的な答え:</strong><p>${answer}</p>`;

  // MathJax再描画
  if (window.MathJax) {
    MathJax.typesetPromise([answerContainer]).catch(err => console.error('MathJax error:', err));
  }
}

   
