const firebaseAuthMessages = {
  'auth/email-already-in-use': 'Este e-mail ja esta cadastrado. Tente entrar ou use outro e-mail.',
  'auth/weak-password': 'A senha esta fraca. Use uma senha mais forte para continuar.',
  'auth/user-not-found': 'Nao encontramos uma conta com este e-mail.',
  'auth/wrong-password': 'Senha incorreta. Confira e tente novamente.',
  'auth/invalid-credential': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  'auth/invalid-email': 'Informe um e-mail valido para continuar.',
  'auth/missing-password': 'Informe sua senha para continuar.',
  'auth/network-request-failed': 'Falha de conexao com o Firebase. Verifique sua internet e tente novamente.',
  'auth/too-many-requests': 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.',
  'auth/operation-not-allowed': 'Login por e-mail e senha nao esta habilitado no Firebase.'
}

export const getFirebaseAuthErrorMessage = (error) => {
  const code = error?.code

  return firebaseAuthMessages[code] || 'Nao foi possivel autenticar com o Firebase. Tente novamente.'
}

export const isFirebaseAuthError = (error) => {
  return typeof error?.code === 'string' && error.code.startsWith('auth/')
}
