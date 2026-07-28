/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ArenaGame } from './components/ArenaGame';

export default function App() {
  return (
    <div className="w-screen h-screen bg-slate-950 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
      <ArenaGame />
    </div>
  );
}

