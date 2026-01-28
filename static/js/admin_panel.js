async function toggleTest(testId) {
    if (!confirm('Изменить статус теста?')) return;
    
    try {
        const response = await fetch(`/admin/test/${testId}/toggle`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            location.reload();
        }
    } catch (error) {
        alert('Ошибка изменения статуса');
    }
}

async function deleteTest(testId) {
    if (!confirm('Вы уверены, что хотите удалить этот тест? Это действие нельзя отменить.')) return;
    
    try {
        const response = await fetch(`/admin/test/${testId}/delete`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            location.reload();
        }
    } catch (error) {
        alert('Ошибка удаления теста');
    }
}
