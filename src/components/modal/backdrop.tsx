import type {PropsWithChildren} from "react";

export const Backdrop = (props: PropsWithChildren) => {
    return (
        <div className="z-[800] absolute top-0 bottom-0 left-0 right-0 flex justify-center items-center bg-dark-900/[.85]">
            {props.children}
        </div>
    )
}

export default Backdrop;