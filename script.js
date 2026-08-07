let programStack = [];
let isRunning = false;

const BLOCK_TYPES = {
  LED_ON: { label: 'Turn LED ON', type: 'led', value: true },
  LED_OFF: { label: 'Turn LED OFF', type: 'led', value: false },
  SERVO_0: { label: 'Set Servo to 0°', type: 'servo', value: 0 },
  SERVO_90: { label: 'Set Servo to 90°', type: 'servo', value: 90 },
  WAIT_1S: { label: 'Wait 1 Second', type: 'wait', value: 1000 }
};

function addBlock(blockKey) {
  if (isRunning) return;
  programStack.push(BLOCK_TYPES[blockKey]);
  renderWorkspace();
}

function removeBlock(index) {
  if (isRunning) return;
  programStack.splice(index, 1);
  renderWorkspace();
}

function clearProgram() {
  if (isRunning) return;
  programStack = [];
  renderWorkspace();
  logConsole("Workspace cleared.");
}

function renderWorkspace() {
  const listEl = document.getElementById('program-list');
  listEl.innerHTML = '';

  if (programStack.length === 0) {
    listEl.innerHTML = '<li class="empty-msg">No blocks added yet. Click blocks on the left!</li>';
    return;
  }

  programStack.forEach((block, idx) => {
    const li = document.createElement('li');
    li.className = 'program-item';
    li.id = `step-${idx}`;
    li.innerHTML = `
      <span>${idx + 1}. ${block.label}</span>
      <button class="remove-btn" onclick="removeBlock(${idx})">✕</button>
    `;
    listEl.appendChild(li);
  });
}

async function runProgram() {
  if (isRunning || programStack.length === 0) return;
  
  isRunning = true;
  document.getElementById('run-btn').innerText = '⏳ Running...';
  logConsole("Starting program execution...");

  for (let i = 0; i < programStack.length; i++) {
    const block = programStack[i];
    highlightStep(i);

    if (block.type === 'led') {
      const ledEl = document.getElementById('sim-led');
      if (block.value) {
        ledEl.classList.add('on');
        logConsole("GPIO: LED pin set to HIGH");
      } else {
        ledEl.classList.remove('on');
        logConsole("GPIO: LED pin set to LOW");
      }
    } else if (block.type === 'servo') {
      const armEl = document.getElementById('sim-servo-arm');
      armEl.style.transform = `rotate(${block.value}deg)`;
      logConsole(`PWM: Servo angle set to ${block.value}°`);
    } else if (block.type === 'wait') {
      logConsole(`DELAY: Waiting ${block.value / 1000}s...`);
      await new Promise(res => setTimeout(res, block.value));
    }

    if (block.type !== 'wait') {
      await new Promise(res => setTimeout(res, 300));
    }
  }

  clearStepHighlights();
  logConsole("Done!");
  document.getElementById('run-btn').innerText = '▶ Run Program';
  isRunning = false;
}

function highlightStep(index) {
  clearStepHighlights();
  const stepEl = document.getElementById(`step-${index}`);
  if (stepEl) stepEl.classList.add('active-step');
}

function clearStepHighlights() {
  document.querySelectorAll('.program-item').forEach(el => el.classList.remove('active-step'));
}

function resetSimulation() {
  if (isRunning) return;

  const ledEl = document.getElementById('sim-led');
  if (ledEl) ledEl.classList.remove('on');

  const armEl = document.getElementById('sim-servo-arm');
  if (armEl) armEl.style.transform = 'rotate(0deg)';

  logConsole("Hardware state reset to default (LED: OFF, Servo: 0°).");
}

function logConsole(text) {
  const consoleEl = document.getElementById('console-output');
  if (consoleEl) consoleEl.innerText = `> ${text}`;
}