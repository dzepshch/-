let questions = [];
let currentQuestionIndex = 0;
let userAnswers = {};
let timerMode = 'none';
let totalTimeSeconds = 0;
let questionTimeSeconds = 60;
let timerInterval = null;
let startTime = null;

// Элементы DOM
const testSettings = document.getElementById('testSettings');
const testContainer = document.getElementById('testContainer');
const resultsContainer = document.getElementById('resultsContainer');
const startTestBtn = document.getElementById('startTestBtn');
const questionContainer = document.getElementById('questionContainer');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const showAnswerBtn = document.getElementById('showAnswerBtn');
const timerDisplay = document.getElementById('timer');
const answerModal = document.getElementById('answerModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const retryBtn = document.getElementById('retryBtn');

// Настройка таймера
document.querySelectorAll('input[name="timerMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const totalTimeInput = document.getElementById('totalTimeInput');
        if (e.target.value === 'total') {
            totalTimeInput.classList.remove('hidden');
        } else {
            totalTimeInput.classList.add('hidden');
        }
    });
});

// Начало теста
startTestBtn.addEventListener('click', async () => {
    timerMode = document.querySelector('input[name="timerMode"]:checked').value;
    
    if (timerMode === 'total') {
        totalTimeSeconds = parseInt(document.getElementById('totalTime').value) * 60;
    }
    
    // Загрузка вопросов
    try {
        const response = await fetch(`/api/test/${TEST_ID}/questions`);
        const data = await response.json();
        
        if (data.success) {
            questions = data.questions;
            userAnswers = {};
            currentQuestionIndex = 0;
            startTime = Date.now();
            
            testSettings.classList.add('hidden');
            testContainer.classList.remove('hidden');
            
            document.getElementById('totalQuestions').textContent = questions.length;
            
            renderQuestionNumbers();
            showQuestion(0);
            
            if (timerMode === 'total') {
                startTotalTimer();
            } else if (timerMode === 'perQuestion') {
                startQuestionTimer();
            }
        }
    } catch (error) {
        alert('Ошибка загрузки теста');
    }
});

// Отображение вопроса
function showQuestion(index) {
    if (index < 0 || index >= questions.length) return;
    
    currentQuestionIndex = index;
    const question = questions[index];
    
    // Обновление прогресса
    document.getElementById('currentQuestion').textContent = index + 1;
    const progress = ((index + 1) / questions.length) * 100;
    document.getElementById('progressFill').style.width = progress + '%';
    
    // Рендер вопроса
    let html = `<h3 class="question-text">${question.text}</h3>`;
    
    if (question.image) {
        html += `<img src="${question.image}" class="question-image" alt="Изображение вопроса">`;
    }
    
    html += '<div class="answers-list">';
    
    const inputType = question.is_multiple ? 'checkbox' : 'radio';
    const savedAnswers = userAnswers[question.id] || [];
    
    question.answers.forEach(answer => {
        const isChecked = savedAnswers.includes(answer.id) ? 'checked' : '';
        const isSelected = savedAnswers.includes(answer.id) ? 'selected' : '';
        
        html += `
            <label class="answer-option ${isSelected}" data-answer-id="${answer.id}">
                <input type="${inputType}" 
                       name="answer_${question.id}" 
                       value="${answer.id}" 
                       ${isChecked}
                       onchange="handleAnswerChange(${question.id}, ${answer.id}, this)">
                <span>${answer.text}</span>
            </label>
        `;
    });
    
    html += '</div>';
    
    questionContainer.innerHTML = html;
    
    // Обновление кнопок
    prevBtn.disabled = index === 0;
    nextBtn.textContent = index === questions.length - 1 ? 'Завершить тест' : 'Следующий →';
    
    // Обновление номеров вопросов
    updateQuestionNumbers();
    
    // Таймер на вопрос
    if (timerMode === 'perQuestion') {
        clearInterval(timerInterval);
        startQuestionTimer();
    }
}

// Обработка изменения ответа
function handleAnswerChange(questionId, answerId, element) {
    const question = questions.find(q => q.id === questionId);
    
    if (question.is_multiple) {
        // Множественный выбор
        if (!userAnswers[questionId]) {
            userAnswers[questionId] = [];
        }
        
        if (element.checked) {
            userAnswers[questionId].push(answerId);
        } else {
            userAnswers[questionId] = userAnswers[questionId].filter(id => id !== answerId);
        }
    } else {
        // Одиночный выбор
        userAnswers[questionId] = [answerId];
    }
    
    // Обновление визуального состояния
    const answerOptions = questionContainer.querySelectorAll('.answer-option');
    answerOptions.forEach(option => {
        const optionAnswerId = parseInt(option.dataset.answerId);
        if (userAnswers[questionId] && userAnswers[questionId].includes(optionAnswerId)) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
    
    updateQuestionNumbers();
}

// Навигация
prevBtn.addEventListener('click', () => {
    if (currentQuestionIndex > 0) {
        showQuestion(currentQuestionIndex - 1);
    }
});

nextBtn.addEventListener('click', () => {
    if (currentQuestionIndex < questions.length - 1) {
        showQuestion(currentQuestionIndex + 1);
    } else {
        finishTest();
    }
});

// Показать правильный ответ
showAnswerBtn.addEventListener('click', async () => {
    const currentQuestion = questions[currentQuestionIndex];
    
    try {
        const response = await fetch(`/api/question/${currentQuestion.id}/correct`);
        const data = await response.json();
        
        if (data.success) {
            const correctTexts = data.correct_answers.map(a => a.text).join(', ');
            document.getElementById('answerModalBody').innerHTML = `
                <p><strong>Правильный ответ:</strong></p>
                <p>${correctTexts}</p>
            `;
            answerModal.classList.add('active');
        }
    } catch (error) {
        alert('Ошибка загрузки ответа');
    }
});

closeModalBtn.addEventListener('click', () => {
    answerModal.classList.remove('active');
});

answerModal.addEventListener('click', (e) => {
    if (e.target === answerModal) {
        answerModal.classList.remove('active');
    }
});

// Навигация по номерам вопросов
function renderQuestionNumbers() {
    const numbersContainer = document.getElementById('questionNumbers');
    let html = '';
    
    questions.forEach((q, index) => {
        html += `
            <div class="question-number" data-index="${index}" onclick="jumpToQuestion(${index})">
                ${index + 1}
            </div>
        `;
    });
    
    numbersContainer.innerHTML = html;
}

function updateQuestionNumbers() {
    const numbers = document.querySelectorAll('.question-number');
    numbers.forEach((num, index) => {
        const questionId = questions[index].id;
        
        num.classList.remove('answered', 'current');
        
        if (index === currentQuestionIndex) {
            num.classList.add('current');
        }
        
        if (userAnswers[questionId] && userAnswers[questionId].length > 0) {
            num.classList.add('answered');
        }
    });
}

function jumpToQuestion(index) {
    showQuestion(index);
}

// Таймеры
function startTotalTimer() {
    let remainingSeconds = totalTimeSeconds;
    timerDisplay.classList.remove('hidden');
    
    updateTimerDisplay(remainingSeconds);
    
    timerInterval = setInterval(() => {
        remainingSeconds--;
        updateTimerDisplay(remainingSeconds);
        
        if (remainingSeconds <= 60) {
            timerDisplay.classList.add('warning');
        }
        if (remainingSeconds <= 30) {
            timerDisplay.classList.remove('warning');
            timerDisplay.classList.add('danger');
        }
        
        if (remainingSeconds <= 0) {
            clearInterval(timerInterval);
            finishTest();
        }
    }, 1000);
}

function startQuestionTimer() {
    let remainingSeconds = questionTimeSeconds;
    const questionTimerDisplay = document.getElementById('timerDisplay');
    questionTimerDisplay.classList.remove('hidden');
    
    questionTimerDisplay.textContent = formatTime(remainingSeconds);
    
    timerInterval = setInterval(() => {
        remainingSeconds--;
        questionTimerDisplay.textContent = formatTime(remainingSeconds);
        
        if (remainingSeconds <= 10) {
            questionTimerDisplay.style.color = '#ef4444';
        } else {
            questionTimerDisplay.style.color = 'var(--primary-green)';
        }
        
        if (remainingSeconds <= 0) {
            clearInterval(timerInterval);
            if (currentQuestionIndex < questions.length - 1) {
                showQuestion(currentQuestionIndex + 1);
            } else {
                finishTest();
            }
        }
    }, 1000);
}

function updateTimerDisplay(seconds) {
    timerDisplay.textContent = formatTime(seconds);
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Завершение теста
async function finishTest() {
    clearInterval(timerInterval);
    
    const timeSpent = Math.floor((Date.now() - startTime) / 1000);
    
    try {
        const response = await fetch('/api/test/submit', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                test_id: TEST_ID,
                answers: userAnswers,
                time_spent: timeSpent
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            testContainer.classList.add('hidden');
            resultsContainer.classList.remove('hidden');
            
            document.getElementById('finalScore').textContent = `${data.score}/${data.total}`;
            document.getElementById('finalPercentage').textContent = data.percentage;
        }
    } catch (error) {
        alert('Ошибка отправки результатов');
    }
}

// Повторное прохождение
retryBtn.addEventListener('click', () => {
    location.reload();
});
