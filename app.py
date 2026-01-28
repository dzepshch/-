from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime
import sqlite3
import json
import os
import secrets

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
app.config['UPLOAD_FOLDER'] = 'static/uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['ALLOWED_EXTENSIONS'] = {'png', 'jpg', 'jpeg', 'gif', 'json'}

# Для PythonAnywhere
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD_HASH = generate_password_hash('admin123')  # Измените после первого входа!

def get_db():
    """Создание подключения к БД"""
    db = sqlite3.connect('quiz_trainer.db')
    db.row_factory = sqlite3.Row
    return db

def init_db():
    """Инициализация базы данных"""
    db = get_db()
    
    # Таблица пользователей
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Таблица тестов
    db.execute('''
        CREATE TABLE IF NOT EXISTS tests (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active INTEGER DEFAULT 1
        )
    ''')
    
    # Таблица вопросов
    db.execute('''
        CREATE TABLE IF NOT EXISTS questions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            test_id INTEGER NOT NULL,
            question_text TEXT NOT NULL,
            image_path TEXT,
            question_order INTEGER NOT NULL,
            is_multiple INTEGER DEFAULT 0,
            FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE
        )
    ''')
    
    # Таблица вариантов ответов
    db.execute('''
        CREATE TABLE IF NOT EXISTS answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question_id INTEGER NOT NULL,
            answer_text TEXT NOT NULL,
            is_correct INTEGER DEFAULT 0,
            FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
        )
    ''')
    
    # Таблица результатов
    db.execute('''
        CREATE TABLE IF NOT EXISTS test_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            test_id INTEGER NOT NULL,
            score INTEGER NOT NULL,
            total_questions INTEGER NOT NULL,
            time_spent INTEGER,
            completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (test_id) REFERENCES tests (id) ON DELETE CASCADE
        )
    ''')
    
    # Таблица ответов пользователей
    db.execute('''
        CREATE TABLE IF NOT EXISTS user_answers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            result_id INTEGER NOT NULL,
            question_id INTEGER NOT NULL,
            answer_ids TEXT NOT NULL,
            is_correct INTEGER DEFAULT 0,
            FOREIGN KEY (result_id) REFERENCES test_results (id) ON DELETE CASCADE,
            FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
        )
    ''')
    
    db.commit()
    db.close()

def allowed_file(filename):
    """Проверка допустимого расширения файла"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

# Маршруты
@app.route('/')
def index():
    """Главная страница"""
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    """Регистрация пользователя"""
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')
        
        if not username or not email or not password:
            return jsonify({'success': False, 'message': 'Все поля обязательны'}), 400
        
        db = get_db()
        
        # Проверка существующего пользователя
        existing = db.execute('SELECT id FROM users WHERE username = ? OR email = ?', 
                             (username, email)).fetchone()
        if existing:
            db.close()
            return jsonify({'success': False, 'message': 'Пользователь уже существует'}), 400
        
        # Создание пользователя
        password_hash = generate_password_hash(password)
        db.execute('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
                  (username, email, password_hash))
        db.commit()
        db.close()
        
        return jsonify({'success': True, 'message': 'Регистрация успешна'})
    
    return render_template('register.html')

@app.route('/login', methods=['GET', 'POST'])
def login():
    """Вход пользователя"""
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        db.close()
        
        if user and check_password_hash(user['password_hash'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return jsonify({'success': True, 'redirect': url_for('dashboard')})
        
        return jsonify({'success': False, 'message': 'Неверные данные'}), 401
    
    return render_template('login.html')

@app.route('/logout')
def logout():
    """Выход пользователя"""
    session.clear()
    return redirect(url_for('index'))

@app.route('/dashboard')
def dashboard():
    """Панель пользователя"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    db = get_db()
    
    # Получение активных тестов
    tests = db.execute('SELECT * FROM tests WHERE is_active = 1 ORDER BY created_at DESC').fetchall()
    
    # Получение статистики пользователя
    stats = db.execute('''
        SELECT 
            COUNT(*) as tests_taken,
            AVG(CAST(score AS FLOAT) / total_questions * 100) as avg_score,
            SUM(time_spent) as total_time
        FROM test_results
        WHERE user_id = ?
    ''', (session['user_id'],)).fetchone()
    
    # Последние результаты
    recent_results = db.execute('''
        SELECT tr.*, t.title
        FROM test_results tr
        JOIN tests t ON tr.test_id = t.id
        WHERE tr.user_id = ?
        ORDER BY tr.completed_at DESC
        LIMIT 10
    ''', (session['user_id'],)).fetchall()
    
    db.close()
    
    return render_template('dashboard.html', tests=tests, stats=stats, recent_results=recent_results)

@app.route('/test/<int:test_id>')
def test_page(test_id):
    """Страница теста"""
    if 'user_id' not in session:
        return redirect(url_for('login'))
    
    db = get_db()
    test = db.execute('SELECT * FROM tests WHERE id = ? AND is_active = 1', (test_id,)).fetchone()
    
    if not test:
        db.close()
        return redirect(url_for('dashboard'))
    
    db.close()
    return render_template('test.html', test=test)

@app.route('/api/test/<int:test_id>/questions')
def get_test_questions(test_id):
    """API: получение вопросов теста"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Не авторизован'}), 401
    
    db = get_db()
    
    questions = db.execute('''
        SELECT * FROM questions 
        WHERE test_id = ? 
        ORDER BY question_order
    ''', (test_id,)).fetchall()
    
    result = []
    for q in questions:
        answers = db.execute('''
            SELECT id, answer_text FROM answers 
            WHERE question_id = ?
        ''', (q['id'],)).fetchall()
        
        result.append({
            'id': q['id'],
            'text': q['question_text'],
            'image': q['image_path'],
            'is_multiple': bool(q['is_multiple']),
            'answers': [{'id': a['id'], 'text': a['answer_text']} for a in answers]
        })
    
    db.close()
    return jsonify({'success': True, 'questions': result})

@app.route('/api/test/submit', methods=['POST'])
def submit_test():
    """API: отправка результатов теста"""
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Не авторизован'}), 401
    
    data = request.get_json()
    test_id = data.get('test_id')
    answers = data.get('answers')  # {question_id: [answer_ids]}
    time_spent = data.get('time_spent', 0)
    
    db = get_db()
    
    # Получение всех вопросов теста
    questions = db.execute('SELECT id FROM questions WHERE test_id = ?', (test_id,)).fetchall()
    total_questions = len(questions)
    
    score = 0
    
    # Создание записи результата
    cursor = db.execute('''
        INSERT INTO test_results (user_id, test_id, score, total_questions, time_spent)
        VALUES (?, ?, 0, ?, ?)
    ''', (session['user_id'], test_id, total_questions, time_spent))
    result_id = cursor.lastrowid
    
    # Проверка ответов
    for question_id, user_answer_ids in answers.items():
        question_id = int(question_id)
        
        # Получение правильных ответов
        correct_answers = db.execute('''
            SELECT id FROM answers 
            WHERE question_id = ? AND is_correct = 1
        ''', (question_id,)).fetchall()
        correct_ids = set(a['id'] for a in correct_answers)
        user_ids = set(user_answer_ids)
        
        is_correct = correct_ids == user_ids
        if is_correct:
            score += 1
        
        # Сохранение ответа пользователя
        db.execute('''
            INSERT INTO user_answers (result_id, question_id, answer_ids, is_correct)
            VALUES (?, ?, ?, ?)
        ''', (result_id, question_id, json.dumps(user_answer_ids), int(is_correct)))
    
    # Обновление результата
    db.execute('UPDATE test_results SET score = ? WHERE id = ?', (score, result_id))
    db.commit()
    db.close()
    
    return jsonify({
        'success': True, 
        'score': score, 
        'total': total_questions,
        'percentage': round(score / total_questions * 100, 2)
    })

@app.route('/api/question/<int:question_id>/correct')
def get_correct_answer(question_id):
    """API: получение правильного ответа"""
    if 'user_id' not in session:
        return jsonify({'success': False}), 401
    
    db = get_db()
    correct_answers = db.execute('''
        SELECT id, answer_text FROM answers 
        WHERE question_id = ? AND is_correct = 1
    ''', (question_id,)).fetchall()
    db.close()
    
    return jsonify({
        'success': True,
        'correct_answers': [{'id': a['id'], 'text': a['answer_text']} for a in correct_answers]
    })

# Админ-панель
@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Вход в админ-панель"""
    if request.method == 'POST':
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')
        
        if username == ADMIN_USERNAME and check_password_hash(ADMIN_PASSWORD_HASH, password):
            session['admin'] = True
            return jsonify({'success': True, 'redirect': url_for('admin_panel')})
        
        return jsonify({'success': False, 'message': 'Неверные данные'}), 401
    
    return render_template('admin_login.html')

@app.route('/admin')
def admin_panel():
    """Админ-панель"""
    if 'admin' not in session:
        return redirect(url_for('admin_login'))
    
    db = get_db()
    tests = db.execute('SELECT * FROM tests ORDER BY created_at DESC').fetchall()
    db.close()
    
    return render_template('admin_panel.html', tests=tests)

@app.route('/admin/logout')
def admin_logout():
    """Выход из админ-панели"""
    session.pop('admin', None)
    return redirect(url_for('admin_login'))

@app.route('/admin/test/create', methods=['GET', 'POST'])
def admin_create_test():
    """Создание теста"""
    if 'admin' not in session:
        return redirect(url_for('admin_login'))
    
    if request.method == 'POST':
        data = request.get_json()
        title = data.get('title')
        description = data.get('description', '')
        
        db = get_db()
        cursor = db.execute('INSERT INTO tests (title, description) VALUES (?, ?)',
                           (title, description))
        test_id = cursor.lastrowid
        db.commit()
        db.close()
        
        return jsonify({'success': True, 'test_id': test_id})
    
    return render_template('admin_create_test.html')

@app.route('/admin/test/<int:test_id>/upload', methods=['POST'])
def admin_upload_test(test_id):
    """Загрузка теста из JSON"""
    if 'admin' not in session:
        return jsonify({'success': False}), 401
    
    if 'file' not in request.files:
        return jsonify({'success': False, 'message': 'Файл не найден'}), 400
    
    file = request.files['file']
    if file.filename == '' or not allowed_file(file.filename):
        return jsonify({'success': False, 'message': 'Недопустимый файл'}), 400
    
    try:
        data = json.load(file)
        db = get_db()
        
        for q_data in data.get('questions', []):
            # Сохранение изображения если есть
            image_path = None
            if 'image' in q_data and q_data['image']:
                # Предполагается base64 или URL
                image_path = q_data['image']
            
            cursor = db.execute('''
                INSERT INTO questions (test_id, question_text, image_path, question_order, is_multiple)
                VALUES (?, ?, ?, ?, ?)
            ''', (test_id, q_data['text'], image_path, q_data.get('order', 0), 
                  int(q_data.get('is_multiple', False))))
            question_id = cursor.lastrowid
            
            for answer in q_data.get('answers', []):
                db.execute('''
                    INSERT INTO answers (question_id, answer_text, is_correct)
                    VALUES (?, ?, ?)
                ''', (question_id, answer['text'], int(answer.get('is_correct', False))))
        
        db.commit()
        db.close()
        
        return jsonify({'success': True, 'message': 'Тест успешно загружен'})
    
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/admin/test/<int:test_id>/toggle', methods=['POST'])
def admin_toggle_test(test_id):
    """Включение/выключение теста"""
    if 'admin' not in session:
        return jsonify({'success': False}), 401
    
    db = get_db()
    test = db.execute('SELECT is_active FROM tests WHERE id = ?', (test_id,)).fetchone()
    
    if test:
        new_status = 0 if test['is_active'] else 1
        db.execute('UPDATE tests SET is_active = ? WHERE id = ?', (new_status, test_id))
        db.commit()
    
    db.close()
    return jsonify({'success': True})

@app.route('/admin/test/<int:test_id>/delete', methods=['POST'])
def admin_delete_test(test_id):
    """Удаление теста"""
    if 'admin' not in session:
        return jsonify({'success': False}), 401
    
    db = get_db()
    db.execute('DELETE FROM tests WHERE id = ?', (test_id,))
    db.commit()
    db.close()
    
    return jsonify({'success': True})

if __name__ == '__main__':
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    init_db()
    app.run(debug=True)
