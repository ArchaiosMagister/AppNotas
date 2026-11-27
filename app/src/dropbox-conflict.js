/** Read-only recovery for divergent copies. No remote/local writes, no merge.
 * Both exports are standard locally decryptable historical .cdoc envelopes.
 * The caller receives ciphertext only, not decrypted notebook contents.
 */
import {openDropboxSnapshot} from './dropbox-sync.js';
import {seal} from './vault.js';
import {compareBookVersions} from './cuaderno.js';
export async function prepareConflictCopies({transport,readLocal,verifyLocal,signal}){
  const local=readLocal();
  const current=async()=>!signal?.aborted&&local&&await verifyLocal(local,signal)&&!signal?.aborted;
  if(!local?.envelope||!await current())throw new Error('Local notebook changed.');
  const entry=await transport.download({signal});
  if(!entry||!await current())throw new Error('Remote or local notebook changed.');
  const remote=await openDropboxSnapshot(entry.snapshot,local.key,local.salt);
  const relation=compareBookVersions(local.doc,remote);
  if(!['divergent','unknown','different'].includes(relation))throw new Error('No divergent versions.');
  const encryptedRemote=await seal(remote,local.key,local.salt);
  if(!await current())throw new Error('Local notebook changed.');
  return {local:structuredClone(local.envelope),remote:encryptedRemote,relation};
}
