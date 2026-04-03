import { Ball, D, GP, Tablet, timer } from "./instances";
import { GameConf } from "../config";

type Axis = "x" | "y";

/** Game entity with axis-aligned bounds and velocity (ball, paddle, etc.). */
export type BoundsEntity = {
    x: number;
    y: number;
    ox: number;
    oy: number;
    vx: number;
    vy: number;
    cx: number;
    cy: number;
};

export type BoundaryCallbacks = [(() => unknown) | null, (() => unknown) | null, (() => unknown) | null, (() => unknown) | null];

export default class Interaction {
    collisionStat = 0;
    accelerateCD = GameConf.Ball.ACCELERATION.COOLDOWN * 1000;
    prevAccTime: [number, number] = [0, 0];

    boundaryDetect(
        ge: BoundsEntity,
        {
            bounce = false,
            paddings = [0, 0, 0, 0] as [number, number, number, number],
            callbacks = [null, null, null, null] as BoundaryCallbacks,
        }: {
            bounce?: boolean;
            paddings?: [number, number, number, number];
            callbacks?: BoundaryCallbacks;
        } = {},
    ): void {
        const bounceRatio = bounce ? -1 : 0;
        if (ge.x < paddings[3]) {
            if (callbacks[3]?.() === void 0) {
                ge.x = paddings[3];
                ge.vx *= bounceRatio;
            }
        } else if (ge.ox > GP.bw - paddings[1]) {
            if (callbacks[1]?.() === void 0) {
                ge.ox = GP.bw - paddings[1];
                ge.vx *= bounceRatio;
            }
        }
        if (ge.y < paddings[0]) {
            if (callbacks[0]?.() === void 0) {
                ge.y = paddings[0];
                ge.vy *= bounceRatio;
            }
        } else if (ge.oy > GP.bh - paddings[2]) {
            if (callbacks[2]?.() === void 0) {
                ge.oy = GP.bh - paddings[2];
                ge.vy *= bounceRatio;
            }
        }
    }

    collisionDetect(): boolean {
        if (!this.#preciselyDetect()) {
            this.collisionStat = 0;
            return false;
        }
        if (this.collisionStat) return false;
        this.collisionStat = 1;

        const bvx = Ball.vx!;
        const bvy = Ball.vy!;
        const bcx = Ball.cx!;
        const bcy = Ball.cy!;
        const tcx = Tablet.cx!;
        const tcy = Tablet.cy!;

        const overlapX = Math.min(Ball.ox!, Tablet.ox!) - Math.max(Ball.x!, Tablet.x!);
        const overlapY = Math.min(Ball.oy!, Tablet.oy!) - Math.max(Ball.y!, Tablet.y!);

        // 原实现用位运算 `^` 做方向判断，但速度/坐标是浮点数时会被截断为 32-bit int，
        // 方向逻辑可能不可靠。这里改为基于正负号的判断，语义更稳定也更可读。
        const relX = bcx - tcx;
        const relY = bcy - tcy;
        const sameXDirection = (bvx > 0 && relX > 0) || (bvx < 0 && relX < 0);
        const sameYDirection = (bvy > 0 && relY > 0) || (bvy < 0 && relY < 0);
        if (sameXDirection && sameYDirection) {
            Ball.x! += bvx * 1.5;
            Ball.y! += bvy * 1.5;
            Ball.vx! += Math.sign(bvx) * this.tempAccelerate("x");
            Ball.vy! += Math.sign(bvy) * this.tempAccelerate("y");
        } else if (sameYDirection || (overlapX < overlapY && !sameXDirection)) {
            if (bcx < tcx) Ball.ox = Tablet.x!;
            else Ball.x = Tablet.ox!;
            Ball.vx! += Math.sign(Ball.vx!) * this.tempAccelerate("x");
            Ball.vx! *= -1;
        } else {
            if (bcy < tcy) Ball.oy = Tablet.y!;
            else Ball.y = Tablet.oy!;
            Ball.vy! += Math.sign(Ball.vy!) * this.tempAccelerate("y");
            Ball.vy! *= -1;
        }
        return true;
    }

    tempAccelerate(direction: Axis): number {
        if (direction !== "x" && direction !== "y") return 0;
        const now = performance.now();
        const patI = direction === "x" ? 0 : 1;
        if (this.prevAccTime[patI] !== void 0 && now - this.prevAccTime[patI] < this.accelerateCD) return 0;
        this.prevAccTime[patI] = now;
        const { RATIO_X1, RATIO_X2, RATIO_Y1, RATIO_Y2, DECAY_DELAY, DECAY_TIMES } = GameConf.Ball.ACCELERATION;
        const ratio1 = direction === "x" ? RATIO_X1 : RATIO_Y1;
        const ratio2 = direction === "x" ? RATIO_X2 : RATIO_Y2;
        const ballV = direction === "x" ? Ball.vx : Ball.vy;
        const tabletV = direction === "x" ? Tablet.vx : Tablet.vy;
        const tabletMax = direction === "x" ? Tablet.vxMax : Tablet.vyMax;
        const vBuffRatio = ratio1 - Math.sign(ballV) * tabletV * ratio2 / tabletMax;
        const vBuff = D(ballV * (vBuffRatio - 1));
        const vUnitNerf = vBuff / DECAY_TIMES;
        timer.newInterval(
            () => {
                if (direction === "x") Ball.vx -= Math.sign(Ball.vx) * vUnitNerf;
                else Ball.vy -= Math.sign(Ball.vy) * vUnitNerf;
            },
            0,
            {
                delay: DECAY_DELAY * 1000,
                executeTimes: DECAY_TIMES,
            },
        );
        return vBuff;
    }

    #preciselyDetect(): boolean {
        const bx = Ball.x!;
        const box = Ball.ox!;
        const by = Ball.y!;
        const boy = Ball.oy!;
        const tx = Tablet.x!;
        const tox = Tablet.ox!;
        const ty = Tablet.y!;
        const toy = Tablet.oy!;
        if (box < tx || bx > tox || boy < ty || by > toy) return false;

        const bcx = Ball.cx!;
        const bcy = Ball.cy!;
        const tcx = Tablet.cx!;
        const tcy = Tablet.cy!;
        if ((bcx >= tx && bcx <= tox) || (bcy >= ty && bcy <= toy)) return true;

        const dx = bcx - (bcx < tcx ? tx : tox);
        const dy = bcy - (bcy < tcy ? ty : toy);
        const r = Ball.w! / 2;
        return dx * dx + dy * dy <= r * r;
    }
}
