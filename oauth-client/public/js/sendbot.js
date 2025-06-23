
document.addEventListener('DOMContentLoaded', function () {

    const linkForm = document.getElementById('linkForm');
    const linkInput = document.getElementById('linkInput');
    const submitLinkButton = document.getElementById('submitLinkButton');
    const formMessage = document.getElementById('formMessage');
    const sendLinkModalEl = document.getElementById('sendLinkModal');

    // Chỉ khởi tạo modal instance nếu sendLinkModalEl tồn tại
    let modalInstance = null;
    if (sendLinkModalEl) {
        modalInstance = new bootstrap.Modal(sendLinkModalEl); // Sử dụng new bootstrap.Modal()
    } else {
        console.error('Modal element #sendLinkModal not found.');
    }

    // URL API của bot (BẠN CẦN THAY THẾ URL NÀY CHO ĐÚNG)
    const BOT_API_ENDPOINT = 'https://bot.services.com/check_url';
    // Ví dụ nếu API của bạn chạy local và cần HTTPS cho mixed content:
    // const BOT_API_ENDPOINT = 'https://localhost:8888/check_url';
    // Ví dụ nếu cả hai đều là HTTP (cho dev)
    // const BOT_API_ENDPOINT = 'http://localhost:8888/check_url';


    if (linkForm && submitLinkButton) { // Kiểm tra các element chính có tồn tại không
        linkForm.addEventListener('submit', async function (event) {
            event.preventDefault();

            const linkValue = linkInput.value.trim();
            if (!linkValue) {
                showMessage('Vui lòng nhập một link.', 'danger');
                linkInput.focus();
                return;
            }

            try {
                new URL(linkValue); // Kiểm tra định dạng URL cơ bản
            } catch (_) {
                showMessage('Định dạng link không hợp lệ.', 'danger');
                linkInput.focus();
                return;
            }

            submitLinkButton.disabled = true;
            const spinner = submitLinkButton.querySelector('.spinner-border');
            const textSpan = submitLinkButton.querySelector('span:not(.spinner-border)');

            if (spinner) {
                spinner.classList.remove('d-none');
            }
            if (textSpan) {
                textSpan.textContent = 'Đang gửi...';
            }
            if (formMessage) {
                formMessage.innerHTML = '';
            }


            try {
                const response = await fetch(BOT_API_ENDPOINT, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ link: linkValue })
                });

                const responseDataText = await response.text(); // Đọc text trước để debug
                let responseData;
                try {
                    responseData = JSON.parse(responseDataText); // Thử parse JSON
                } catch (e) {
                    console.error("Failed to parse server response as JSON:", responseDataText);
                    throw new Error(`Server response was not valid JSON. Status: ${response.status}. Response: ${responseDataText}`);
                }


                if (!response.ok) {
                    throw new Error(`Lỗi ${response.status}: ${responseData.message || response.statusText || 'Lỗi không xác định từ server.'}`);
                }

                console.log('Phản hồi từ bot:', responseData);
                showMessage('Link đã được gửi thành công!', 'success');
                linkForm.reset();

                if (modalInstance) {
                    setTimeout(() => {
                        modalInstance.hide();
                    }, 2000);
                }

            } catch (error) {
                console.error('Lỗi khi gửi link:', error);
                showMessage(`Gửi link thất bại: ${error.message}`, 'danger');
            } finally {
                submitLinkButton.disabled = false;
                if (spinner) {
                    spinner.classList.add('d-none');
                }
                if (textSpan) {
                    textSpan.textContent = 'Gửi Link';
                }
            }
        });
    } else {
        console.error('Form or submit button not found for link submission.');
    }

    function showMessage(message, type = 'info') {
        if (formMessage) {
            formMessage.innerHTML = `<div class="alert alert-${type} mt-2" role="alert">${message}</div>`;
        } else {
            console.warn("Form message element not found, cannot display message:", message);
        }
    }

    if (sendLinkModalEl) {
        sendLinkModalEl.addEventListener('shown.bs.modal', function () {
            if (linkInput) linkInput.focus();
            if (formMessage) formMessage.innerHTML = '';
        });

        // sendLinkModalEl.addEventListener('hidden.bs.modal', function () {
        // Tùy chọn: reset form khi modal đóng
        // if (formMessage && !formMessage.querySelector('.alert-success')) {
        //    if(linkForm) linkForm.reset();
        // }
        // if (formMessage) formMessage.innerHTML = '';
        // });
    }

}); // Kết thúc DOMContentLoaded
