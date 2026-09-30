import type { CSSProperties } from "react";

type PlayerLook = {
  shirt: string;
  trim: string;
  shorts: string;
  skin: string;
  hair: string;
  hairStyle: "spike" | "sweep" | "crop" | "wave";
};

const PLAYER_LOOKS: Record<string, PlayerLook> = {
  "ma-long": {
    shirt: "#c91e35",
    trim: "#f2c05b",
    shorts: "#252c3b",
    skin: "#e7b895",
    hair: "#20212a",
    hairStyle: "crop",
  },
  "fan-zhendong": {
    shirt: "#d13a34",
    trim: "#f1d27b",
    shorts: "#23344a",
    skin: "#dca985",
    hair: "#23232b",
    hairStyle: "crop",
  },
  "zhang-jike": {
    shirt: "#b91f32",
    trim: "#f2b747",
    shorts: "#25242c",
    skin: "#ecc09e",
    hair: "#25242b",
    hairStyle: "sweep",
  },
  "xu-xin": {
    shirt: "#087d78",
    trim: "#e8c664",
    shorts: "#183c42",
    skin: "#e3b596",
    hair: "#24242c",
    hairStyle: "wave",
  },
  "lin-gaoyuan": {
    shirt: "#3474bd",
    trim: "#b6dcdf",
    shorts: "#263c64",
    skin: "#e7b797",
    hair: "#25252c",
    hairStyle: "crop",
  },
  "wang-chuqin": {
    shirt: "#285fbe",
    trim: "#62d0d3",
    shorts: "#24385e",
    skin: "#edbd9b",
    hair: "#25242c",
    hairStyle: "spike",
  },
  "tomokazu-harimoto": {
    shirt: "#0875c8",
    trim: "#59d6c9",
    shorts: "#194c87",
    skin: "#f0c4a3",
    hair: "#292831",
    hairStyle: "spike",
  },
  "truls-moregard": {
    shirt: "#e4dfd2",
    trim: "#4f89b2",
    shorts: "#315171",
    skin: "#efc6a7",
    hair: "#b78758",
    hairStyle: "wave",
  },
};

function hairShape(style: PlayerLook["hairStyle"]): string {
  if (style === "spike")
    return "M119 56 Q114 47 118 39 L124 44 L126 30 L135 37 L144 24 L151 34 L162 25 L165 38 L175 34 Q182 45 177 56 Q168 51 157 47 Q145 53 136 48 Q128 54 119 56Z";
  if (style === "sweep")
    return "M119 56 Q115 39 125 30 Q137 20 153 23 Q168 23 176 38 Q179 46 176 55 Q164 49 154 43 Q142 51 128 50Z";
  if (style === "wave")
    return "M118 57 Q113 43 122 34 Q128 25 137 29 Q144 18 152 27 Q161 21 169 31 Q180 39 178 54 Q170 49 163 45 Q151 55 137 49 Q127 54 118 57Z";
  return "M118 56 Q116 38 126 29 Q136 21 150 23 Q169 22 176 37 Q181 45 176 56 Q165 51 157 47 Q144 51 133 49 Q125 54 118 56Z";
}

export function AnimatedAthlete({
  playerId,
  name,
  motion,
  role,
  outcome,
}: {
  playerId: string;
  name: string;
  motion: string;
  role: "attack" | "defense";
  outcome: "winner" | "loser";
}) {
  const look = PLAYER_LOOKS[playerId] ?? PLAYER_LOOKS["ma-long"]!;
  return (
    <svg
      className={`animated-athlete motion-${motion} role-${role} outcome-${outcome}`}
      viewBox="0 0 300 330"
      role="img"
      aria-label={`${name}挥拍${role === "attack" ? "进攻" : "防守"}`}
      style={
        {
          "--athlete-shirt": look.shirt,
          "--athlete-trim": look.trim,
          "--athlete-shorts": look.shorts,
          "--athlete-skin": look.skin,
          "--athlete-hair": look.hair,
        } as CSSProperties
      }
    >
      <ellipse
        className="athlete-ground-shadow"
        cx="148"
        cy="311"
        rx="105"
        ry="12"
      />
      <g className="athlete-body">
        <g className="athlete-leg athlete-leg-back">
          <path
            className="athlete-upper-short"
            d="M157 186 Q183 185 199 202 L220 233 L191 253 L158 225Z"
          />
          <path
            className="athlete-upper-limb"
            d="M195 229 Q207 241 219 255 L235 281 Q238 290 228 296 L214 294 Q199 275 188 259 L177 245Z"
          />
          <path
            className="athlete-shoe"
            d="M223 286 Q239 281 250 292 L269 303 Q277 311 266 316 L226 315 Q215 311 216 302Z"
          />
          <path className="athlete-shoe-sole" d="M219 311 Q240 314 269 311" />
        </g>
        <g className="athlete-leg athlete-leg-front">
          <path
            className="athlete-upper-short"
            d="M124 185 Q151 183 169 195 L166 222 L132 242 L102 222Z"
          />
          <path
            className="athlete-upper-limb"
            d="M113 224 Q101 239 91 255 L75 281 Q71 291 81 296 L95 293 Q111 275 122 259 L139 244Z"
          />
          <path
            className="athlete-shoe"
            d="M78 284 Q62 281 50 292 L32 303 Q24 312 36 316 L77 314 Q89 311 88 301Z"
          />
          <path className="athlete-shoe-sole" d="M31 311 Q54 315 83 310" />
        </g>
        <path
          className="athlete-torso"
          d="M120 91 Q134 82 147 84 Q163 80 178 91 L198 113 L181 137 L181 193 Q155 205 124 193 L122 143 L103 124Z"
        />
        <path
          className="athlete-shirt-panel"
          d="M151 89 L165 96 L151 119 L139 97Z"
        />
        <path className="athlete-shirt-stripe" d="M123 130 Q150 144 185 130" />
        <path
          className="athlete-neck"
          d="M137 74 L137 94 Q147 103 158 91 L156 73Z"
        />
        <g className="athlete-head">
          <path
            className="athlete-ear"
            d="M123 55 Q114 50 115 62 Q117 70 124 69Z"
          />
          <path
            className="athlete-ear"
            d="M173 55 Q182 50 181 62 Q179 70 172 69Z"
          />
          <path
            className="athlete-face"
            d="M121 48 Q120 31 135 26 Q148 20 162 26 Q177 31 176 48 L173 66 Q169 80 153 87 Q146 90 137 84 Q123 75 121 61Z"
          />
          <path
            className="athlete-face-shadow"
            d="M157 31 Q173 38 172 57 Q171 74 153 85 Q162 72 161 55 Q159 42 157 31Z"
          />
          <path className="athlete-hair" d={hairShape(look.hairStyle)} />
          <path className="athlete-brow" d="M129 54 Q136 51 143 54" />
          <path className="athlete-brow" d="M154 54 Q161 51 168 54" />
          <ellipse
            className="athlete-eye-white"
            cx="137"
            cy="60"
            rx="4.6"
            ry="3.3"
          />
          <ellipse
            className="athlete-eye-white"
            cx="161"
            cy="60"
            rx="4.6"
            ry="3.3"
          />
          <ellipse className="athlete-eye" cx="138" cy="60" rx="1.9" ry="2.5" />
          <ellipse className="athlete-eye" cx="160" cy="60" rx="1.9" ry="2.5" />
          <path
            className="athlete-nose"
            d="M149 60 Q147 66 145 68 Q149 71 153 68"
          />
          <path className="athlete-mouth" d="M141 76 Q149 80 157 76" />
        </g>
        <g className="athlete-arm athlete-arm-balance">
          <path
            className="athlete-upper-limb"
            d="M184 105 Q199 102 211 115 L226 133 L213 147 L193 132 L177 126Z"
          />
          <g className="athlete-forearm">
            <path
              className="athlete-upper-limb"
              d="M222 137 Q237 138 249 129 L260 120 L268 132 Q258 150 237 155 L222 151Z"
            />
            <path
              className="athlete-hand"
              d="M258 119 Q269 113 277 118 L280 125 L273 129 L276 136 L269 139 L263 132Z"
            />
          </g>
        </g>
        <g className="athlete-arm athlete-arm-racket">
          <path
            className="athlete-upper-limb"
            d="M119 103 Q105 105 96 117 L82 137 L96 150 L113 135 L131 124Z"
          />
          <g className="athlete-forearm">
            <path
              className="athlete-upper-limb"
              d="M89 141 Q77 148 66 141 L52 133 L45 145 Q57 160 78 158 L96 151Z"
            />
            <path
              className="athlete-hand"
              d="M49 132 Q39 124 31 128 L27 135 L34 141 L31 148 L38 152 L45 145Z"
            />
            <g className="athlete-racket">
              <path d="M36 137 L54 126" />
              <ellipse
                cx="25"
                cy="118"
                rx="20"
                ry="13"
                transform="rotate(-28 25 118)"
              />
              <path
                className="athlete-racket-face"
                d="M11 116 Q24 103 39 112"
              />
            </g>
          </g>
        </g>
      </g>
      <circle className="athlete-ball" cx="49" cy="104" r="5" />
    </svg>
  );
}
