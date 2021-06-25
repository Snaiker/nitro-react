import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { GetRoomObjectBounds, GetRoomSession, GetTicker } from '../../../../api';
import { ContextMenuViewProps } from './ContextMenuView.types';

const fadeDelay = 3000;
const fadeLength = 75;

export const ContextMenuView: FC<ContextMenuViewProps> = props =>
{
    const { objectId = -1, category = -1, fades = false, close = null, children = null } = props;
    const [ pos, setPos ] = useState<{ x: number, y: number }>({ x: null, y: null });
    const [ opacity, setOpacity ] = useState(1);
    const [ isFading, setIsFading ] = useState(false);
    const [ fadeTime, setFadeTime ] = useState(0);
    const elementRef = useRef<HTMLDivElement>();

    const update = useCallback((time: number) =>
    {
        let fadeTime = time;
        let newOpacity = 1;

        if(isFading)
        {
            setFadeTime(prevValue =>
                {
                    fadeTime += prevValue;

                    return fadeTime;
                });

            newOpacity = ((1 - (fadeTime / fadeLength)) * 1);

            if(newOpacity <= 0)
            {
                close();

                return;
            }

            setOpacity(newOpacity);
        }

        const bounds = GetRoomObjectBounds(GetRoomSession().roomId, objectId, category);

        if(!bounds || !elementRef.current) return;

        setPos({
            x: Math.round(((bounds.left + (bounds.width / 2)) - (elementRef.current.offsetWidth / 2))),
            y: Math.round((bounds.top - elementRef.current.offsetHeight) + 10)
        });
    }, [ objectId, category, isFading, close ]);

    useEffect(() =>
    {
        GetTicker().add(update);

        return () =>
        {
            GetTicker().remove(update);
        }
    }, [ update ]);

    useEffect(() =>
    {
        if(!fades) return;

        const timeout = setTimeout(() => setIsFading(true), fadeDelay);

        return () =>
        {
            clearTimeout(timeout);
        }
    }, [ fades ]);

    return (
        <div ref={ elementRef } className={ 'position-absolute nitro-context-menu ' + (pos.x !== null ? 'visible' : 'invisible') } style={ { left: (pos.x || 0), top: (pos.y || 0), opacity: opacity } }>
            { children }
        </div>
    );
}
