// Fase 6 — certificado digital A1 (.pfx) e assinatura XMLDSig exigida pelo
// padrão ABRASF (RSA-SHA1, C14N, assinatura "enveloped" logo após o
// elemento assinado, com o certificado em KeyInfo).

import * as forge from 'node-forge';
import { SignedXml } from 'xml-crypto';

export interface LoadedCertificate {
  privateKeyPem: string;
  certificatePem: string;
  certificateB64: string;
  subject: string;
  cnpj: string | null;
  validFrom: Date;
  validUntil: Date;
}

/** Abre o .pfx com a senha. Erros viram mensagens claras para o usuário. */
export function loadPfx(pfx: Buffer, password: string): LoadedCertificate {
  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    const asn1 = forge.asn1.fromDer(forge.util.createBuffer(pfx.toString('binary')));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, password);
  } catch (e) {
    const msg = (e as Error).message ?? '';
    throw new Error(/MAC|password|Invalid/i.test(msg)
      ? 'Senha do certificado incorreta (ou arquivo .pfx corrompido).'
      : 'Arquivo de certificado inválido. Envie o certificado A1 no formato .pfx (ou .p12).');
  }
  const keyBags = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []),
  ];
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const key = keyBags.find((b) => b.key)?.key as forge.pki.rsa.PrivateKey | undefined;
  if (!key) throw new Error('O certificado não contém a chave privada (precisa ser um certificado A1 completo).');
  // certificado do titular = o que bate com a chave privada
  const cert = certBags.map((b) => b.cert).find((c) => c && (c.publicKey as forge.pki.rsa.PublicKey).n.equals(key.n)) ?? certBags[0]?.cert;
  if (!cert) throw new Error('O arquivo não contém o certificado.');
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes();
  const cn = String(cert.subject.getField('CN')?.value ?? '');
  const cnpjMatch = cn.match(/(\d{14})/);
  return {
    privateKeyPem: forge.pki.privateKeyToPem(key),
    certificatePem: forge.pki.certificateToPem(cert),
    certificateB64: forge.util.encode64(der),
    subject: cn,
    cnpj: cnpjMatch ? cnpjMatch[1] : null,
    validFrom: cert.validity.notBefore,
    validUntil: cert.validity.notAfter,
  };
}

/** Assina o elemento com o Id informado; a <Signature> fica logo depois dele. */
export function signElement(xml: string, elementName: string, cert: LoadedCertificate): string {
  const sig = new SignedXml({
    privateKey: cert.privateKeyPem,
    publicCert: cert.certificatePem,
    signatureAlgorithm: 'http://www.w3.org/2000/09/xmldsig#rsa-sha1',
    canonicalizationAlgorithm: 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315',
  });
  const xpath = `//*[local-name(.)='${elementName}']`;
  sig.addReference({
    xpath,
    transforms: ['http://www.w3.org/2000/09/xmldsig#enveloped-signature', 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315'],
    digestAlgorithm: 'http://www.w3.org/2000/09/xmldsig#sha1',
  });
  sig.computeSignature(xml, { location: { reference: xpath, action: 'after' } });
  return sig.getSignedXml();
}

/** Confere uma assinatura (usado nos testes). */
export function verifySignature(signedXml: string, certificatePem: string): boolean {
  const m = signedXml.match(/<Signature[\s\S]*?<\/Signature>/);
  if (!m) return false;
  const v = new SignedXml({ publicCert: certificatePem });
  v.loadSignature(m[0]);
  try {
    return v.checkSignature(signedXml);
  } catch {
    return false;
  }
}
