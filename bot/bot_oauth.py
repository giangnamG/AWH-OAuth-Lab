from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

Provider = "https://provider.services.com" # Hoặc URL của bạn

USERNAME_BOT = "bot"
PASSWORD_BOT = "bot"

def run_playwright_bot(target_url_after_login):
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=["--no-sandbox", "--disable-dev-shm-usage"]
        )
        context = browser.new_context(ignore_https_errors=True)
        page = context.new_page()

        print(f"Navigating to Provider: {Provider}")
        try:
            page.goto(Provider, timeout=60000)
            print("Successfully navigated to Provider.")
            page.wait_for_timeout(1000)
            print(f"Page title: {page.title()}")

            print("Attempting to find and click the jumbotron Login button...")
            login_button_jumbotron = page.locator('a.btn.btn-outline-primary[href="/auth/login"]:has-text("Login")')
            login_button_jumbotron.wait_for(state="visible", timeout=10000)
            print("Login button (jumbotron) found, clicking it...")
            login_button_jumbotron.click()

            print("Clicked. Waiting for navigation to login page...")
            page.wait_for_url("**/auth/login", timeout=10000)
            print(f"Successfully navigated to: {page.url}")
            print(f"New page title: {page.title()}")

            # --- Bắt đầu phần điền form login ---
            print("Attempting to fill login form...")

            # Điền username
            page.get_by_label("Username").fill(USERNAME_BOT)

            # Điền password
            page.get_by_label("Password").fill(PASSWORD_BOT)

            print("Username and password filled.")
            page.wait_for_timeout(500) # Chờ một chút để xem

            # Nhấp nút submit "Login"
            submit_button = page.get_by_role("button", name="Login")

            print("Attempting to click submit button...")
            submit_button.click()
            print("Submit button clicked.")

            # Chờ trang chuyển hướng sau khi login thành công
            print("Waiting for page to navigate after login...")
            page.wait_for_url("**/user/profile", timeout=15000) 

            print(f"Successfully logged in and navigated to: {page.url}")
            print(f"New page title after login: {page.title()}")

            # (Thêm các hành động khác sau khi login nếu cần)

            page.wait_for_timeout(2000) 
            
            # --- ĐIỀU HƯỚNG ĐẾN LINK ĐƯỢC GỬI TỚI ---
            if target_url_after_login:
                print(f"Now navigating to the target URL: {target_url_after_login}")
                page.goto(target_url_after_login, timeout=60000)
                print(f"Successfully navigated to target URL: {page.url}")
                print(f"Page title of target URL: {page.title()}")
                # (Bạn có thể thêm các hành động khác với trang này ở đây)
                page.wait_for_timeout(10000) # Chờ 10 giây để xem trang đích
            else:
                print("No target URL provided after login. Staying on profile/dashboard.")
                page.wait_for_timeout(5000)

        except PlaywrightTimeoutError as e:
            print(f"A timeout occurred: {e}")
            page.screenshot(path="error_screenshot_timeout.png")
            print("Screenshot saved to error_screenshot_timeout.png")
        except Exception as e:
            print(f"An error occurred: {e}")
            # try:
            #     page.screenshot(path="error_screenshot_exception.png")
            #     print("Screenshot saved to error_screenshot_exception.png")
            # except:
            #     pass
        finally:
            print("Closing browser...")
            browser.close()
            print("Browser closed.")