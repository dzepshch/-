let currentTestId = null;

document.getElementById('createTestForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const title = document.getElementById('title').value;
    const description = document.getElementById('description').value;
    
    try {
        const response = await fetch('/admin/test/create', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ title, description })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentTestId = data.test_id;
            document.getElementById('uploadSection').classList.remove('hidden');
            alert('Тест создан! Теперь загрузите вопросы.');
        }
    } catch (error) {
        alert('Ошибка создания теста');
    }
});

document.getElementById('uploadBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('jsonFile');
    const file = fileInput.files[0];
    const messageDiv = document.getElementById('uploadMessage');
    
    if (!file) {
        messageDiv.innerHTML = '<p style="color: #ef4444;">Выберите файл</p>';
        return;
    }
    
    if (!currentTestId) {
        messageDiv.innerHTML = '<p style="color: #ef4444;">Сначала создайте тест</p>';
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch(`/admin/test/${currentTestId}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            messageDiv.innerHTML = '<p style="color: var(--primary-green); font-weight: 600;">✓ Тест успешно загружен!</p>';
            setTimeout(() => {
                window.location.href = '/admin';
            }, 2000);
        } else {
            messageDiv.innerHTML = `<p style="color: #ef4444;">Ошибка: ${data.message}</p>`;
        }
    } catch (error) {
        messageDiv.innerHTML = '<p style="color: #ef4444;">Ошибка загрузки файла</p>';
    }
});
