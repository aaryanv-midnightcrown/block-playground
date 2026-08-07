let programStack = [];
let isRunning = false;
let currentServoAngle = 0;
let draggedItemIndex = null;
let draggedSource = null;
let libraryKey = null;

const BLOCK_TYPES = {
  // Lights & Sound
  LED_ON: { label: 'Turn LED ON', type: 'led', value: true, code: 'digitalWrite(LED_PIN, HIGH);' },
  LED_OFF: { label: 'Turn LED OFF', type: 'led', value: false, code: 'digitalWrite(LED_PIN, LOW);' },
  RGB_RED: { label: 'Set RGB: Red', type: 'rgb', value: '#ef4444', code: 'setRGB(255, 0, 0);' },
  RGB_GREEN: { label: 'Set RGB: Green', type: 'rgb', value: '#22c55e', code: 'setRGB(0, 255, 0);' },
  RGB_BLUE: { label: 'Set RGB: Blue', type: 'rgb', value: '#3b82f6', code: 'setRGB(0, 0, 255);' },
  RGB_PURPLE: { label: 'Set RGB: Purple', type: 'rgb', value: '#a855f7', code: 'setRGB(168, 85, 247);' },
  RGB_YELLOW: { label: 'Set RGB: Yellow', type: 'rgb', value: '#eab308', code: 'setRGB(234, 179, 8);' },
  RGB_OFF: { label: 'Turn RGB OFF', type: 'rgb', value: '#334155', code: 'setRGB(0, 0, 0);' },
  BUZZER_BEEP: { label: 'Beep Buzzer', type: 'buzzer', value: 880, code: 'tone(BUZZER_PIN, 880, 200);' },

  // Motor Control
  SERVO_ADD_45: { label: 'Move Motor +45°', type: 'servo', delta: 45, absolute: null, code: 'servoAngle = constrain(servoAngle + 45, 0, 180);\nmyServo.write(servoAngle);' },
  SERVO_ADD_90: { label: 'Move Motor +90°', type: 'servo', delta: 90, absolute: null, code: 'servoAngle = constrain(servoAngle + 90, 0, 180);\nmyServo.write(servoAngle);' },
  SERVO_SUB_45: { label: 'Move Motor -45°', type: 'servo', delta: -45, absolute: null, code: 'servoAngle = constrain(servoAngle - 45, 0, 180);\nmyServo.write(servoAngle);' },
  SERVO_SUB_90: { label: 'Move Motor -90°', type: 'servo', delta: -90, absolute: null, code: 'servoAngle = constrain(servoAngle - 90, 0, 180);\nmyServo.write(servoAngle);' },
  SERVO_RESET: { label: 'Reset Motor to 0°', type: 'servo', delta: 0, absolute: 0, code: 'servoAngle = 0;\nmyServo.write(servoAngle);' },

  // Timing & Loops
  WAIT_05S: { label: 'Wait 0.5 Seconds', type: 'wait', value: 500, code: 'delay(500);' },
  WAIT_1S: { label: 'Wait 1 Second', type: 'wait', value: 1000, code: 'delay(1000);' },
  WAIT_2S: { label: 'Wait 2 Seconds', type: 'wait', value: 2000, code: 'delay(2000);' },
  REPEAT_2X: { label: 'Repeat Sequence 2x', type: 'repeat', times: 2, code: '// Repeat sequence loop\nfor (int r = 0; r < 2; r++) {' }
};

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupLibraryEvents();
  setupWorkspaceEvents();
  setupControlEvents();
  renderWorkspace();
});

function setupNavigation() {
  const landingPage = document.getElementById('landing-page');
  const appPage = document.getElementById('app-page');
  const launchBtn = document.getElementById('launch-btn');
  const backHomeBtn = document.getElementById('back-home-btn');

  launchBtn.addEventListener('click', () => {
    landingPage.classList.add('hidden');
    appPage.classList.remove('hidden');
  });

  backHomeBtn.addEventListener('click', () => {
    appPage.classList.add('hidden');
    landingPage.classList.remove('hidden');
  });
}

function setupLibraryEvents() {
  const libButtons = document.querySelectorAll('.library-panel .block-btn');
  libButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-key');
      addBlock(key);
    });

    btn.addEventListener('dragstart', (e) => {
      draggedSource = 'library';
      libraryKey = btn.getAttribute('data-key');
      e.dataTransfer.setData('text/plain', libraryKey);
    });
  });
}

function setupWorkspaceEvents() {
  const workspace = document.getElementById('program-list');

  workspace.addEventListener('dragover', (e) => {
    e.preventDefault();
    workspace.classList.add('drag-over');
  });

  workspace.addEventListener('dragleave', () => {
    workspace.classList.remove('drag-over');
  });

  workspace.addEventListener('drop', (e) => {
    e.preventDefault();
    workspace.classList.remove('drag-over');

    if (isRunning) return;

    if (draggedSource === 'library' && libraryKey) {
      addBlock(libraryKey);
    } else if (draggedSource === 'workspace' && draggedItemIndex !== null) {
      const targetItem = e.target.closest('.program-item');
      if (targetItem) {
        const targetIdx = parseInt(targetItem.getAttribute('data-index'), 10);
        if (!isNaN(targetIdx) && targetIdx !== draggedItemIndex) {
          const movedItem = programStack.splice(draggedItemIndex, 1)[0];
          programStack.splice(targetIdx, 0, movedItem);
          renderWorkspace();
        }
      }
    }

    draggedSource = null;
    draggedItemIndex = null;
    libraryKey = null;
  });
}

function setupControlEvents() {
  document.getElementById('clear-btn').addEventListener('click', clearProgram);
  document.getElementById('run-btn').addEventListener('click', runProgram);
  document.getElementById('reset-btn').addEventListener('click', resetSimulation);

  document.getElementById('tab-btn-sim').addEventListener('click', () => switchTab('sim'));
  document.getElementById('tab-btn-code').addEventListener('click', () => switchTab('code'));
}

function addBlock(key) {
  if (isRunning || !BLOCK_TYPES[key]) return;
  programStack.push({ ...BLOCK_TYPES[key] });
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
  const workspace = document.getElementById('program-list');
  workspace.innerHTML = '';

  if (programStack.length === 0) {
    workspace.innerHTML = '<div class="empty-msg">Click or drag blocks here to start building!</div>';
    generateCode();
    return;
  }

  programStack.forEach((block, idx) => {
    const item = document.createElement('div');
    item.className = 'program-item';
    item.setAttribute('draggable', 'true');
    item.setAttribute('data-index', idx);

    item.innerHTML = `
      <span>☰ ${idx + 1}. ${block.label}</span>
      <button class="remove-btn" data-index="${idx}">✕</button>
    `;

    item.addEventListener('dragstart', (e) => {
      draggedSource = 'workspace';
      draggedItemIndex = idx;
      item.classList.add('dragging');
      e.dataTransfer.setData('text/plain', `${idx}`);
    });

    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });

    const removeBtn = item.querySelector('.remove-btn');
    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      removeBlock(idx);
    });

    workspace.appendChild(item);
  });

  generateCode();
}

async function runProgram() {
  if (isRunning || programStack.length === 0) return;

  isRunning = true;
  document.getElementById('run-btn').innerText = '⏳ Running...';
  logConsole("Starting execution...");

  let executionList = [];

  for (let i = 0; i < programStack.length; i++) {
    const b = programStack[i];
    if (b.type === 'repeat') {
      const rest = programStack.filter(item => item.type !== 'repeat');
      for (let r = 0; r < b.times; r++) {
        executionList.push(...rest);
      }
      break;
    } else {
      executionList.push(b);
    }
  }

  for (let i = 0; i < executionList.length; i++) {
    const block = executionList[i];
    highlightStep(i % programStack.length);

    if (block.type === 'led') {
      const ledEl = document.getElementById('sim-led');
      if (block.value) {
        ledEl.classList.add('on');
        logConsole("GPIO: LED set to HIGH");
      } else {
        ledEl.classList.remove('on');
        logConsole("GPIO: LED set to LOW");
      }
    } else if (block.type === 'rgb') {
      const rgbEl = document.getElementById('sim-rgb');
      rgbEl.style.background = block.value;
      if (block.value !== '#334155') {
        rgbEl.style.boxShadow = `0 0 15px ${block.value}`;
      } else {
        rgbEl.style.boxShadow = 'inset 0 0 5px #000';
      }
      logConsole(`RGB: Color set to ${block.value}`);
    } else if (block.type === 'buzzer') {
      playTone(block.value);
      logConsole(`PWM: Buzzer played ${block.value}Hz tone`);
    } else if (block.type === 'servo') {
      if (block.absolute !== null && block.absolute !== undefined) {
        currentServoAngle = block.absolute;
      } else {
        currentServoAngle = Math.min(180, Math.max(0, currentServoAngle + block.delta));
      }
      document.getElementById('sim-servo-arm').style.transform = `rotate(${currentServoAngle}deg)`;
      document.getElementById('servo-angle-label').innerText = `Servo: ${currentServoAngle}°`;
      logConsole(`PWM: Servo adjusted to ${currentServoAngle}°`);
    } else if (block.type === 'wait') {
      logConsole(`DELAY: Waiting ${block.value / 1000}s...`);
      await new Promise(res => setTimeout(res, block.value));
    }

    if (block.type !== 'wait') {
      await new Promise(res => setTimeout(res, 350));
    }
  }

  clearStepHighlights();
  logConsole("Program complete.");
  document.getElementById('run-btn').innerText = '▶ Run Program';
  isRunning = false;
}

function playTone(freq) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

function highlightStep(index) {
  clearStepHighlights();
  const items = document.querySelectorAll('.program-item');
  if (items[index]) {
    items[index].classList.add('active-step');
  }
}

function clearStepHighlights() {
  document.querySelectorAll('.program-item').forEach(el => el.classList.remove('active-step'));
}

function resetSimulation() {
  if (isRunning) return;

  document.getElementById('sim-led').classList.remove('on');
  
  const rgbEl = document.getElementById('sim-rgb');
  rgbEl.style.background = '#334155';
  rgbEl.style.boxShadow = 'inset 0 0 5px #000';

  currentServoAngle = 0;
  document.getElementById('sim-servo-arm').style.transform = 'rotate(0deg)';
  document.getElementById('servo-angle-label').innerText = 'Servo: 0°';

  logConsole("Hardware reset to defaults.");
}

function logConsole(text) {
  document.getElementById('console-output').innerText = `> ${text}`;
}

function switchTab(tabName) {
  document.getElementById('tab-btn-sim').classList.toggle('active', tabName === 'sim');
  document.getElementById('tab-btn-code').classList.toggle('active', tabName === 'code');
  document.getElementById('view-sim').classList.toggle('active', tabName === 'sim');
  document.getElementById('view-code').classList.toggle('active', tabName === 'code');
}

function generateCode() {
  let codeStr = `#include <Servo.h>\n\nconst int LED_PIN = 13;\nconst int BUZZER_PIN = 8;\nServo myServo;\nint servoAngle = 0;\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n  pinMode(BUZZER_PIN, OUTPUT);\n  myServo.attach(9);\n  myServo.write(0);\n}\n\nvoid loop() {\n`;

  if (programStack.length === 0) {
    codeStr += `  // Add blocks to sequence...\n`;
  } else {
    programStack.forEach(block => {
      const indented = block.code.split('\n').map(line => `  ${line}`).join('\n');
      codeStr += `${indented}\n`;
    });
  }

  codeStr += `  delay(1000);\n}`;
  document.getElementById('code-output').textContent = codeStr;
}