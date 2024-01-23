import LPLogo from '../../../../assets/icon@512.png';
import { classNames } from '../../../../lib/utils';
import Divider from '../../../primitives/divider';

//TODO: Add Sha stuff
const linkClasses = "transition-colors duration-200 text-blurple-500 hover:text-blurple-300"
export const AboutPage = () => {
  return (
    <div className="p-3">
      <div className="flex flex-row space-x-4">
        <img src={LPLogo} className="w-36 h-36" />
        <div className="flex-grow flex flex-col justify-start leading-snug">
          <div className="flex flex-col justify-start items-center font-bold">
            <h1 className="text-3xl font-bold text-center">Lunchpad<span className="text-xs ml-2">0.0.1</span></h1>
            <span className="text-sm font-bold">(c) 2024 by Tillmann Hübner &lt;<a className={classNames(linkClasses, "text-sm")} href="mailto:ruohki@gmail.com">ruohki@gmail.com</a>&gt;</span>
            <a className={classNames(linkClasses, "text-xs mt-2")} href="#">sha:caf284546f6f748a5d97a562fef8d3a91c349a06</a>
            <Divider />
          </div>
          <p>This software is distributed under the ISC License and is free of any charge. If you paid money for it - you got ripped off.</p>
          <br />
          <p>All product and company names are trademarks™ or registered® trademarks of their respective holders. Use of them does not imply any affiliation with or endorsement by them.</p>
          <p>All specifications are subject to change without notice.</p>
          <p>Launchpad is a trademark of Focusrite-Novation</p>
          <br />
          <p>You can grab a copy of this software on Discord.</p>
          <a className={linkClasses} href="#">https://discord.gg/4Ys9TRR</a>
        </div>
      </div>
    </div>
  )
}

export default AboutPage;