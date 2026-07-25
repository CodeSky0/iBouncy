import { Ellipse } from "leafer-game";
import type { IAnimate } from "@leafer-ui/interface";
import { leafer } from "../core/instances";
import { effectsEnabled } from "../core/effects";
import { UIConf } from "../config";

interface Particle {
    shape: Ellipse;
    vx: number;
    vy: number;
}

const conf = UIConf.CollisionParticle;

export default class X_CollisionParticle {
    private readonly pool: Ellipse[] = [];
    private readonly activeSet = new Set<Ellipse>();
    private readonly poolLimit = 64;

    emit(x: number, y: number): void {
        if (!effectsEnabled) return;

        for (let i = 0; i < conf.COUNT; i++) {
            const p = this.acquireShape();
            const angle = (Math.PI * 2 * i) / conf.COUNT + (Math.random() - 0.5) * 0.5;
            const speed = 0.3 + Math.random() * 0.7;
            const vx = Math.cos(angle) * conf.SPREAD * speed;
            const vy = Math.sin(angle) * conf.SPREAD * speed;

            p.x = x;
            p.y = y;
            p.w = p.h = (conf.MIN_RADIUS + Math.random() * (conf.MAX_RADIUS - conf.MIN_RADIUS)) * 2;
            const c = conf.COLORS[Math.floor(Math.random() * conf.COLORS.length)];
            p.fill = c;
            p.opacity = 0.9;
            p.visible = true;

            const duration = conf.DURATION * (0.5 + Math.random() * 0.5);

            const aniMove = p.animate(
                [
                    { style: { offsetX: 0, offsetY: 0 } },
                    { style: { offsetX: vx, offsetY: vy } },
                ],
                { duration, easing: "quad-out", join: true },
            );
            const aniFade = p.animate(
                [
                    { opacity: 0.9 },
                    { opacity: 0 },
                ],
                { duration, easing: "sine-in", join: true },
            );

            const handleComplete = () => {
                p.visible = false;
                (p as unknown as Record<string, unknown>).offsetX = 0;
                (p as unknown as Record<string, unknown>).offsetY = 0;
                this.activeSet.delete(p);
                if (this.pool.length < this.poolLimit) {
                    this.pool.push(p);
                } else {
                    p.destroy();
                }
            };

            setTimeout(handleComplete, duration * 1000 + 50);
        }
    }

    private acquireShape(): Ellipse {
        const fromPool = this.pool.pop();
        if (fromPool) {
            this.activeSet.add(fromPool);
            return fromPool;
        }
        if (this.activeSet.size >= this.poolLimit) {
            const reuse = this.activeSet.values().next().value;
            if (reuse) return reuse;
        }
        const shape = new Ellipse({
            x: -100,
            y: -100,
            width: 4,
            height: 4,
            around: "center",
            visible: false,
        });
        shape.render_();
        this.activeSet.add(shape);
        return shape;
    }
}
