const firebaseAuthMessages = {
  'auth/email-already-in-use': 'Este e-mail já está cadastrado. Tente entrar ou use outro e-mail.',
  'auth/weak-password': 'A senha está fraca. Use uma senha mais forte para continuar.',
  'auth/user-not-found': 'Não encontramos uma conta com este e-mail.',
  'auth/wrong-password': 'Senha incorreta. Confira e tente novamente.',
  'auth/invalid-credential': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  'auth/invalid-email': 'Informe um e-mail válido para continuar.',
  'auth/missing-password': 'Informe sua senha para continuar.',
  'auth/network-request-failed': 'Falha de conexão com o Firebase. Verifique sua internet e tente novamente.',
  'auth/too-many-requests': 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.',
  'auth/operation-not-allowed': 'Login por e-mail e senha não está habilitado no Firebase.',
  'auth/popup-closed-by-user': 'O popup foi fechado antes de concluir o login.',
  'auth/cancelled-popup-request': 'Já existe uma tentativa de login aberta. Conclua ou tente novamente.',
  'auth/popup-blocked': 'O navegador bloqueou o popup do Google. Libere popups para continuar.',
  'auth/account-exists-with-different-credential': 'Este e-mail já existe com outro método de login. Entre com e-mail e senha e vincule o Google em Configurações.',
  'auth/provider-already-linked': 'Esta conta já possui Google vinculado.',
  'auth/credential-already-in-use': 'Esta conta Google já está vinculada a outro cadastro.',
  'auth/requires-recent-login': 'Por segurança, saia e entre novamente antes de alterar métodos de login.',
  'auth/missing-email': 'Informe um e-mail válido para continuar.',
  'auth/user-token-expired': 'Sua sessão expirou. Entre novamente para continuar.'
}

export const getFirebaseAuthErrorMessage = (error) => {
  const code = error?.code

  return firebaseAuthMessages[code] || 'Não foi possível autenticar com o Firebase. Tente novamente.'
}

export const isFirebaseAuthError = (error) => {
  return typeof error?.code === 'string' && error.code.startsWith('auth/')
}
