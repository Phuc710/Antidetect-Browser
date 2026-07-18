import { describe, it, expect } from 'vitest';

interface FormState {
  email: string;
  password: string;
}

interface FormErrors {
  email?: string;
  password?: string;
  general?: string;
}

function validateLoginForm(form: FormState): FormErrors {
  const errors: FormErrors = {};
  const normalizedEmail = form.email.trim();

  if (!normalizedEmail) {
    errors.email = 'Vui lòng nhập tài khoản / email.';
  }

  if (!form.password) {
    errors.password = 'Vui lòng nhập mật khẩu.';
  }

  return errors;
}

describe('Login Validation and Submission Safeguards Unit Tests', () => {
  it('should return errors for empty email and password', () => {
    const errors = validateLoginForm({ email: '   ', password: '' });
    expect(errors.email).toBe('Vui lòng nhập tài khoản / email.');
    expect(errors.password).toBe('Vui lòng nhập mật khẩu.');
  });

  it('should accept valid email/username and password', () => {
    const errors = validateLoginForm({ email: 'dev@example.com ', password: 'secretpassword' });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('should prevent duplicate submissions while isLoading is true', () => {
    let callCount = 0;
    let isLoading = true;

    function submitForm() {
      if (isLoading) return; // Prevent duplicate submit
      callCount++;
    }

    submitForm();
    submitForm();
    expect(callCount).toBe(0);

    isLoading = false;
    submitForm();
    expect(callCount).toBe(1);
  });
});
