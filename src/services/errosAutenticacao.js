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

const firebaseAuthTranslationKeys = {
  'auth/email-already-in-use': 'errors.firebase.emailAlreadyInUse',
  'auth/weak-password': 'errors.firebase.weakPassword',
  'auth/user-not-found': 'errors.firebase.userNotFound',
  'auth/wrong-password': 'errors.firebase.wrongPassword',
  'auth/invalid-credential': 'errors.firebase.invalidCredential',
  'auth/invalid-email': 'errors.firebase.invalidEmail',
  'auth/missing-password': 'errors.firebase.missingPassword',
  'auth/network-request-failed': 'errors.firebase.networkRequestFailed',
  'auth/too-many-requests': 'errors.firebase.tooManyRequests',
  'auth/operation-not-allowed': 'errors.firebase.operationNotAllowed',
  'auth/popup-closed-by-user': 'errors.firebase.popupClosed',
  'auth/cancelled-popup-request': 'errors.firebase.cancelledPopup',
  'auth/popup-blocked': 'errors.firebase.popupBlocked',
  'auth/account-exists-with-different-credential': 'errors.firebase.accountDifferentCredential',
  'auth/provider-already-linked': 'errors.firebase.providerAlreadyLinked',
  'auth/credential-already-in-use': 'errors.firebase.credentialAlreadyInUse',
  'auth/requires-recent-login': 'errors.firebase.requiresRecentLogin',
  'auth/missing-email': 'errors.firebase.missingEmail',
  'auth/user-token-expired': 'errors.firebase.userTokenExpired'
}

export const getFirebaseAuthErrorMessage = (error) => {
  const code = error?.code

  return firebaseAuthMessages[code] || 'Não foi possível autenticar com o Firebase. Tente novamente.'
}

export const getFirebaseAuthErrorKey = (error) => {
  return firebaseAuthTranslationKeys[error?.code] || 'errors.firebase.fallback'
}

export const isFirebaseAuthError = (error) => {
  return typeof error?.code === 'string' && error.code.startsWith('auth/')
}
