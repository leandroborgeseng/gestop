export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_MIN_LENGTH_NEW = 8;

export const PASSWORD_POLICY_HINT =
  'A senha deve conter no mínimo 8 caracteres, pelo menos uma letra maiúscula e pelo menos um caractere especial.';

const HAS_UPPERCASE = /[A-ZÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ]/;
const HAS_SPECIAL = /[^A-Za-zÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑáàâãäéèêëíìîïóòôõöúùûüçñ0-9]/;

export type PasswordPolicyIssue = 'length' | 'uppercase' | 'special';

export function collectPasswordPolicyIssues(password: string): PasswordPolicyIssue[] {
  const value = password.trim();
  const issues: PasswordPolicyIssue[] = [];
  if (value.length < PASSWORD_MIN_LENGTH_NEW || value.length > PASSWORD_MAX_LENGTH) {
    issues.push('length');
  }
  if (!HAS_UPPERCASE.test(value)) {
    issues.push('uppercase');
  }
  if (!HAS_SPECIAL.test(value)) {
    issues.push('special');
  }
  return issues;
}

export function describePasswordPolicyIssues(issues: PasswordPolicyIssue[]): string {
  const labels: Record<PasswordPolicyIssue, string> = {
    length: `mínimo de ${PASSWORD_MIN_LENGTH_NEW} e máximo de ${PASSWORD_MAX_LENGTH} caracteres`,
    uppercase: 'pelo menos uma letra maiúscula',
    special: 'pelo menos um caractere especial',
  };
  return issues.map((issue) => labels[issue]).join('; ');
}

export function validatePasswordPolicy(password: string): string | null {
  const issues = collectPasswordPolicyIssues(password);
  if (issues.length === 0) return null;
  return `Senha inválida: ${describePasswordPolicyIssues(issues)}.`;
}
