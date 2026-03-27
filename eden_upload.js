/**
 * Eden.so YouTube Link Uploader — with Auto Login
 *
 * SETUP (one time):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * USAGE:
 *   node eden_upload.js
 *
 *   1. Browser opens, logs in to Eden automatically via Gmail
 *   2. Navigate to your DOAC project page
 *   3. Press Enter — script uploads all links
 */

const { chromium } = require('playwright');
const { google } = require('googleapis');
const fs = require('fs');

const CREDENTIALS_FILE = 'gmail_credentials.json';
const TOKEN_FILE = 'gmail_token.json';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const EDEN_EMAIL = 'danielthompson5611@gmail.com';

const CONFIG = {
  urls: `
https://www.youtube.com/watch?v=3uLDin9A9pc
https://www.youtube.com/watch?v=kNOX7a7-kwQ
https://www.youtube.com/watch?v=nTiqySjdD6s
https://www.youtube.com/watch?v=o2YAqL0YkGc
https://www.youtube.com/watch?v=DAVw-yQRUjE
https://www.youtube.com/watch?v=3j0TeHIZxHo
https://www.youtube.com/watch?v=nYrjhv-AFZA
https://www.youtube.com/watch?v=ke6KS8WuPUk
https://www.youtube.com/watch?v=OMfc98lOw_M
https://www.youtube.com/watch?v=iLlrIi9-NfQ
https://www.youtube.com/watch?v=_CLli3_Vlrc
https://www.youtube.com/watch?v=U-NJZJOAz88
https://www.youtube.com/watch?v=ALV6ItXdUYI
https://www.youtube.com/watch?v=br5jH40svQ4
https://www.youtube.com/watch?v=1DV6I5hK6ro
https://www.youtube.com/watch?v=VYta88JUbBs
https://www.youtube.com/watch?v=_vSymiIrKP8
https://www.youtube.com/watch?v=qWwrcivl3qQ
https://www.youtube.com/watch?v=PwNs626zKUI
https://www.youtube.com/watch?v=cwPKlERwcGk
https://www.youtube.com/watch?v=I1i1kXw8L4M
https://www.youtube.com/watch?v=H4gh63mJI1c
https://www.youtube.com/watch?v=kvzbh_HY1Yw
https://www.youtube.com/watch?v=mW6jgKCKqiA
https://www.youtube.com/watch?v=fJjsbgk6e0A
https://www.youtube.com/watch?v=-eOSj-gsAf8
https://www.youtube.com/watch?v=NZd9luVXB80
https://www.youtube.com/watch?v=6ZA9pCkc7Qk
https://www.youtube.com/watch?v=GZt1acKg_bI
https://www.youtube.com/watch?v=PjSFlFqxyGc
https://www.youtube.com/watch?v=8yVP1cCM4AU
https://www.youtube.com/watch?v=Q-zuTZuYeCg
https://www.youtube.com/watch?v=ct2k6iXLurg
https://www.youtube.com/watch?v=8bUGVETockI
https://www.youtube.com/watch?v=Mvcu6UfY7d4
https://www.youtube.com/watch?v=SgPVgPYnT_M
https://www.youtube.com/watch?v=nWwnm-z6mOw
https://www.youtube.com/watch?v=0KDESUdPRXs
https://www.youtube.com/watch?v=HgOZZpq1-wc
https://www.youtube.com/watch?v=RsLCmp3KiQI
https://www.youtube.com/watch?v=bzilnhq3Mkg
https://www.youtube.com/watch?v=V6mZJRb9MZY
https://www.youtube.com/watch?v=Kj5yp0PrfqA
https://www.youtube.com/watch?v=_5gfJdpgXvc
https://www.youtube.com/watch?v=1o343YfhaYU
https://www.youtube.com/watch?v=VQpETBh0GOc
https://www.youtube.com/watch?v=q6KGsI6QzD4
https://www.youtube.com/watch?v=TB0yceuXmrI
https://www.youtube.com/watch?v=mgEs61k2mxY
https://www.youtube.com/watch?v=5zhEVdBuPDo
https://www.youtube.com/watch?v=bxdMrA36qhE
https://www.youtube.com/watch?v=Hz3RWxJck68
https://www.youtube.com/watch?v=tKIFHQShPnA
https://www.youtube.com/watch?v=qC-U7qy7cH4
https://www.youtube.com/watch?v=lGSZqhFFhoI
https://www.youtube.com/watch?v=wvwCZO9UKZE
https://www.youtube.com/watch?v=cMCucLELzd0
https://www.youtube.com/watch?v=78_jmynAjLw
https://www.youtube.com/watch?v=AZCUFvVQyLo
https://www.youtube.com/watch?v=uViyOJsc6O4
https://www.youtube.com/watch?v=tWvF2RzSnd4
https://www.youtube.com/watch?v=PYkkRlx-IK4
https://www.youtube.com/watch?v=ktl0UdZtL1A
https://www.youtube.com/watch?v=dfzFFQgG2zU
https://www.youtube.com/watch?v=vE1KnWX2thQ
https://www.youtube.com/watch?v=Jpw_DbRqy5Q
https://www.youtube.com/watch?v=VcFNahUxd3k
https://www.youtube.com/watch?v=FfBhj5H93pI
https://www.youtube.com/watch?v=gEAMi3p1hO0
https://www.youtube.com/watch?v=iDsYrU2o2R8
https://www.youtube.com/watch?v=FR570m_YzNg
https://www.youtube.com/watch?v=H4EYLof2_HU
https://www.youtube.com/watch?v=kXGYIFuQ2Es
https://www.youtube.com/watch?v=qDw8zT7pCdQ
https://www.youtube.com/watch?v=vHpZEMesriU
https://www.youtube.com/watch?v=s_Ig-M8IAAY
https://www.youtube.com/watch?v=NpmAsMs_m2g
https://www.youtube.com/watch?v=uPup-1pDepY
https://www.youtube.com/watch?v=kMouTbVeRNY
https://www.youtube.com/watch?v=ca5h47tJsdE
https://www.youtube.com/watch?v=ZAYg2zQ0arE
https://www.youtube.com/watch?v=D27OchSqU-Q
https://www.youtube.com/watch?v=cj8ojSVgU9I
https://www.youtube.com/watch?v=pktiT3JVpVU
https://www.youtube.com/watch?v=UnMGuZUPCxg
https://www.youtube.com/watch?v=xyP0ypFKtZ0
https://www.youtube.com/watch?v=-Fmiqik4jh0
https://www.youtube.com/watch?v=e6d9PJLAQmE
https://www.youtube.com/watch?v=_yZiNnQftxU
https://www.youtube.com/watch?v=Y7QgYVMJ5u4
https://www.youtube.com/watch?v=ji_N6orURuw
https://www.youtube.com/watch?v=v9VtjcRaRWc
https://www.youtube.com/watch?v=66hWntvp0_4
https://www.youtube.com/watch?v=acjj3NsokSo
https://www.youtube.com/watch?v=0DZK1nawEXQ
https://www.youtube.com/watch?v=AVblCpr_qAc
https://www.youtube.com/watch?v=YWnaf_Zd5_Y
https://www.youtube.com/watch?v=MoxkayJ8SnA
https://www.youtube.com/watch?v=2q69Id3-Amk
https://www.youtube.com/watch?v=cLTUA1lneS0
https://www.youtube.com/watch?v=Gy_vcL1cpP8
https://www.youtube.com/watch?v=NO_GdfSe9To
https://www.youtube.com/watch?v=DYCPtL43VE4
https://www.youtube.com/watch?v=ygn3tMlp1-M
https://www.youtube.com/watch?v=44iAPrQoYU8
https://www.youtube.com/watch?v=It5DFXULOq0
https://www.youtube.com/watch?v=xlYbp36HPb0
https://www.youtube.com/watch?v=r3atRG5wvtg
https://www.youtube.com/watch?v=jR8Zq0xuCz8
https://www.youtube.com/watch?v=Us8n8VBQn_c
https://www.youtube.com/watch?v=3XP9J3UyTUo
https://www.youtube.com/watch?v=D46zvJI-njU
https://www.youtube.com/watch?v=R-5H70SfbG8
https://www.youtube.com/watch?v=Qv70RMUFlu0
https://www.youtube.com/watch?v=H0lbv1pgMc0
https://www.youtube.com/watch?v=knPqBc2qJ8E
https://www.youtube.com/watch?v=x3e73Qn6NOo
https://www.youtube.com/watch?v=oMwAN30FJAQ
https://www.youtube.com/watch?v=K2tGt2XWd9Q
https://www.youtube.com/watch?v=ULSEjCKTGZ0
https://www.youtube.com/watch?v=V7AYmOBahsU
https://www.youtube.com/watch?v=V7a8X8AB8yU
https://www.youtube.com/watch?v=t_pZ2D_nlD0
https://www.youtube.com/watch?v=zEJX6WzET6Q
https://www.youtube.com/watch?v=DnEJrgc1BCk
https://www.youtube.com/watch?v=gTnLQ3cobBM
https://www.youtube.com/watch?v=F6PxgTV-BJk
https://www.youtube.com/watch?v=Itg00I2q8lk
https://www.youtube.com/watch?v=2Ait0WaCNCw
https://www.youtube.com/watch?v=GHxXHKpMBm8
https://www.youtube.com/watch?v=p7O0Zyn0SkM
https://www.youtube.com/watch?v=4YZCUb1DNJk
https://www.youtube.com/watch?v=bk-nQ7HF6k4
https://www.youtube.com/watch?v=PDg7m489d1M
https://www.youtube.com/watch?v=hUZ_WcBQFds
https://www.youtube.com/watch?v=l5WybwqCZic
https://www.youtube.com/watch?v=e2mQOGzHtQc
https://www.youtube.com/watch?v=SkAZRNg-VWY
https://www.youtube.com/watch?v=XkxZCJ2pYqs
https://www.youtube.com/watch?v=1cRmjpBBn7s
https://www.youtube.com/watch?v=cI2rMEd6GW4
https://www.youtube.com/watch?v=YSWvtGdmUA4
https://www.youtube.com/watch?v=ujRwf1HdNjk
https://www.youtube.com/watch?v=OEDzn83BxFo
https://www.youtube.com/watch?v=om3RWW9GQQ4
https://www.youtube.com/watch?v=ORqd9QAC8OY
https://www.youtube.com/watch?v=eqPnptAtBJk
https://www.youtube.com/watch?v=NB4jZCxRkTw
https://www.youtube.com/watch?v=1m-2QhqdlfI
https://www.youtube.com/watch?v=1yfoonW1InE
https://www.youtube.com/watch?v=GmlrEgLGozw
https://www.youtube.com/watch?v=cuVTVOdkmek
https://www.youtube.com/watch?v=q3Rf_9GFico
https://www.youtube.com/watch?v=XtT4fI-NkXU
https://www.youtube.com/watch?v=PafvhTSC4yE
https://www.youtube.com/watch?v=DeMv_qeCV88
https://www.youtube.com/watch?v=YEM3nWkB-EE
https://www.youtube.com/watch?v=CTxnLsYHWuI
https://www.youtube.com/watch?v=FyLwVyJ9uXw
https://www.youtube.com/watch?v=amUpZsEl5Rs
https://www.youtube.com/watch?v=4C7aWQ0aSU8
https://www.youtube.com/watch?v=_y_vSmiNpBE
https://www.youtube.com/watch?v=YY7Jeh_jCww
https://www.youtube.com/watch?v=hCW2NHbWNwA
https://www.youtube.com/watch?v=w_35cUaU_NA
https://www.youtube.com/watch?v=7XrntcEUjLM
https://www.youtube.com/watch?v=ia6Di_ytiSE
https://www.youtube.com/watch?v=L7zWT3l3DV0
https://www.youtube.com/watch?v=vwFxptz77II
https://www.youtube.com/watch?v=PACpvHgJ9HM
https://www.youtube.com/watch?v=dzUDhstqXbg
https://www.youtube.com/watch?v=ow3ao6YsCgQ
https://www.youtube.com/watch?v=ycTZ_t-aiuU
https://www.youtube.com/watch?v=jnYrxVXQKS0
https://www.youtube.com/watch?v=vOvLFT4v4LQ
https://www.youtube.com/watch?v=Htg3HCgrJK4
https://www.youtube.com/watch?v=7KTwmEGsY5g
https://www.youtube.com/watch?v=TqNrJNhcf5g
https://www.youtube.com/watch?v=cRjzQuzX-tg
https://www.youtube.com/watch?v=9BDmC5u_MLE
https://www.youtube.com/watch?v=iEo48f_Rs4w
https://www.youtube.com/watch?v=nTWXfo7narw
https://www.youtube.com/watch?v=vFuyiCnROzs
https://www.youtube.com/watch?v=TTzgD6Tn9DY
https://www.youtube.com/watch?v=oQqcnYcKx68
https://www.youtube.com/watch?v=2bUfUN9wUrs
https://www.youtube.com/watch?v=WJcIfLUR6gg
https://www.youtube.com/watch?v=oI7BxBNp1uE
https://www.youtube.com/watch?v=qqabbfk9wV8
https://www.youtube.com/watch?v=-Hwlvkfp698
https://www.youtube.com/watch?v=aivpDPCP7Q8
https://www.youtube.com/watch?v=UzOJiqN_DpM
https://www.youtube.com/watch?v=FN0_ow76hU8
https://www.youtube.com/watch?v=qRY-foz-ZAw
https://www.youtube.com/watch?v=3GVInaBCn_c
https://www.youtube.com/watch?v=A-8tPmQtYqs
https://www.youtube.com/watch?v=i2sHBL8BjWI
https://www.youtube.com/watch?v=WLWbFVKFffM
https://www.youtube.com/watch?v=uPXjt6beYbg
https://www.youtube.com/watch?v=AVSn8EYQ43I
https://www.youtube.com/watch?v=E5swtIjpxxA
https://www.youtube.com/watch?v=u0o3IlsEQbI
https://www.youtube.com/watch?v=hQ78Hpwrt80
https://www.youtube.com/watch?v=hTkKXDvSJvo
https://www.youtube.com/watch?v=QVVe2rCHtN0
https://www.youtube.com/watch?v=B_5N_aDu3u0
https://www.youtube.com/watch?v=SNuHbJbuUZE
https://www.youtube.com/watch?v=Znoi6tBtYRc
https://www.youtube.com/watch?v=USE89i0kiiQ
https://www.youtube.com/watch?v=sb2kXdfJmww
https://www.youtube.com/watch?v=mS3bfCt0K88
https://www.youtube.com/watch?v=HUoPA6oP6do
https://www.youtube.com/watch?v=J5lAgTvbGS8
https://www.youtube.com/watch?v=ojNTQRW-SXM
https://www.youtube.com/watch?v=lbzn5iz8Mbo
https://www.youtube.com/watch?v=uHLAazKUU68
https://www.youtube.com/watch?v=3eZJ_y68wsg
https://www.youtube.com/watch?v=10enqcw2Qiw
https://www.youtube.com/watch?v=IxVNR0Om-lA
https://www.youtube.com/watch?v=0YMnHNIuK3M
https://www.youtube.com/watch?v=hbdQPmjPHhg
https://www.youtube.com/watch?v=-xjneW1XZBs
https://www.youtube.com/watch?v=uTs6SFeny5Q
https://www.youtube.com/watch?v=4DWKf5RqU-s
https://www.youtube.com/watch?v=1Rd9Iuxjb5k
https://www.youtube.com/watch?v=ToUpAWW7u4c
https://www.youtube.com/watch?v=w8h4qksd6Yw
https://www.youtube.com/watch?v=iz_SJ5TpLJ0
https://www.youtube.com/watch?v=Cgo2mD4Pc54
https://www.youtube.com/watch?v=I3WUiD8HYn8
https://www.youtube.com/watch?v=-pdCDq_MTj4
https://www.youtube.com/watch?v=_vX-_fq-c50
https://www.youtube.com/watch?v=MrjIXLQ_OdA
https://www.youtube.com/watch?v=Desm53JJVMA
https://www.youtube.com/watch?v=XDcESvzX58Y
https://www.youtube.com/watch?v=_J1lFZEBq2Y
https://www.youtube.com/watch?v=rKOx5qlLyaA
https://www.youtube.com/watch?v=kxLmeUIXXtU
https://www.youtube.com/watch?v=D6wTuogebU8
https://www.youtube.com/watch?v=R87QLweXl1A
https://www.youtube.com/watch?v=P_A8XElrAqA
https://www.youtube.com/watch?v=HSVbD7RhOHU
https://www.youtube.com/watch?v=fybq6V74qRk
https://www.youtube.com/watch?v=4mmLOoloH3E
https://www.youtube.com/watch?v=IYu_PDPqKFc
https://www.youtube.com/watch?v=_cFu-b5lTMU
https://www.youtube.com/watch?v=S1JXKT7mf9A
https://www.youtube.com/watch?v=PM9rgDBX9u0
https://www.youtube.com/watch?v=jSqCL7Npln0
https://www.youtube.com/watch?v=MsERVcx0Qg8
https://www.youtube.com/watch?v=78YN1e8UXdM
https://www.youtube.com/watch?v=1g9VX34MSUA
https://www.youtube.com/watch?v=OTrTqs9FLq0
https://www.youtube.com/watch?v=H9kPmiV0B34
https://www.youtube.com/watch?v=3esF-pNAM9c
https://www.youtube.com/watch?v=GbV6iW26h-Q
https://www.youtube.com/watch?v=2j3T4oYJPfI
https://www.youtube.com/watch?v=P1ALkQMfkjc
https://www.youtube.com/watch?v=SWjzjClBCO4
https://www.youtube.com/watch?v=6bL24eHvwoc
https://www.youtube.com/watch?v=pz6jhMPA-2w
https://www.youtube.com/watch?v=FsztuzyXdhY
https://www.youtube.com/watch?v=8LjNUabIJOk
https://www.youtube.com/watch?v=yelE_brGf-c
https://www.youtube.com/watch?v=oAgGirY-GUQ
https://www.youtube.com/watch?v=inwyi6Zdeo8
https://www.youtube.com/watch?v=XyhhwVJB9Z4
https://www.youtube.com/watch?v=p3fSwd1cF08
https://www.youtube.com/watch?v=2Zg--ouGl7c
https://www.youtube.com/watch?v=MGposaKNJKQ
https://www.youtube.com/watch?v=7-ZCglrexbo
https://www.youtube.com/watch?v=LLMCd3WbgGk
https://www.youtube.com/watch?v=VHUrdELKjDw
https://www.youtube.com/watch?v=rDyTyppGxSg
https://www.youtube.com/watch?v=eTkFItOG3Kk
https://www.youtube.com/watch?v=fajtQSCHfvE
https://www.youtube.com/watch?v=Qx5J5nwDBTo
https://www.youtube.com/watch?v=RvjR9GM2kX8
https://www.youtube.com/watch?v=jyCJeglqCe4
https://www.youtube.com/watch?v=R6xbXOp7wDA
https://www.youtube.com/watch?v=It5_C6AF1pk
https://www.youtube.com/watch?v=IgW1jepnJp4
https://www.youtube.com/watch?v=Hik6OY-nk4c
https://www.youtube.com/watch?v=B7tnfSPySb0
https://www.youtube.com/watch?v=qpBnYB0I6_0
https://www.youtube.com/watch?v=eOnIWDMNyfE
https://www.youtube.com/watch?v=6ikIGGi859w
https://www.youtube.com/watch?v=NyFSkGMWP5Q
https://www.youtube.com/watch?v=Kl-I7sUcAOY
https://www.youtube.com/watch?v=9gk3mNJs2FY
https://www.youtube.com/watch?v=FjrJ2DJN_pA
https://www.youtube.com/watch?v=19_sGcrsWhg
https://www.youtube.com/watch?v=ffgpqk5hZBE
https://www.youtube.com/watch?v=oIiv_335yus
https://www.youtube.com/watch?v=zsuOSDb7gzQ
https://www.youtube.com/watch?v=rBM6lGk4-fk
https://www.youtube.com/watch?v=0GQozcTPyO0
https://www.youtube.com/watch?v=li70iz1NaDY
https://www.youtube.com/watch?v=NSsx6mkiaf8
https://www.youtube.com/watch?v=ZxXruY7llcc
https://www.youtube.com/watch?v=zECoaEZRRFU
https://www.youtube.com/watch?v=rCtvAvZtJyE
https://www.youtube.com/watch?v=ZuiIvevLg40
https://www.youtube.com/watch?v=uxu37dqVR90
https://www.youtube.com/watch?v=EdlXcVu1CTs
https://www.youtube.com/watch?v=OsAlLgGf9JM
https://www.youtube.com/watch?v=JMYQmGfTltY
https://www.youtube.com/watch?v=epAVydG6IxI
https://www.youtube.com/watch?v=Fg7U-BhiZGE
https://www.youtube.com/watch?v=W4tqbEmplug
https://www.youtube.com/watch?v=yHCtfU3syM4
https://www.youtube.com/watch?v=ZznpMh0DegE
https://www.youtube.com/watch?v=j4z25zj6bmE
https://www.youtube.com/watch?v=QCaFWrT0j-g
https://www.youtube.com/watch?v=ZHuZ_8VYCWA
https://www.youtube.com/watch?v=puc5pZVsFPY
https://www.youtube.com/watch?v=mpAZehPviLQ
https://www.youtube.com/watch?v=hxsnk90VwCo
https://www.youtube.com/watch?v=8qObdS-bhRM
https://www.youtube.com/watch?v=I-iyGGPabpI
https://www.youtube.com/watch?v=wQJlGHVmdrA
https://www.youtube.com/watch?v=1NLoTuRR3hE
https://www.youtube.com/watch?v=W0vTZrZny6A
https://www.youtube.com/watch?v=S9a1nLw70p0
https://www.youtube.com/watch?v=hVlAOIUA71Y
https://www.youtube.com/watch?v=yfEQRqFo2bI
https://www.youtube.com/watch?v=5wXlmlIXJOI
https://www.youtube.com/watch?v=qgeQ5kMVwRA
https://www.youtube.com/watch?v=fu6bYPTp_kE
https://www.youtube.com/watch?v=UclrVWafRAI
https://www.youtube.com/watch?v=QXUNnXHXeVQ
https://www.youtube.com/watch?v=49RT6SQ8n0Y
https://www.youtube.com/watch?v=XTGlde-Pbd8
https://www.youtube.com/watch?v=QMzxNfX-uAg
https://www.youtube.com/watch?v=gryta3KZKU4
https://www.youtube.com/watch?v=Esu8BXLBmZ4
https://www.youtube.com/watch?v=ZE_H7rijrVk
https://www.youtube.com/watch?v=jFlnRBO8mcg
https://www.youtube.com/watch?v=lylGyddTiGg
https://www.youtube.com/watch?v=gW3vVIFRVhw
https://www.youtube.com/watch?v=kizDk8idpT8
https://www.youtube.com/watch?v=UMy6GESNkDc
https://www.youtube.com/watch?v=4qfxHfBJ3Mw
https://www.youtube.com/watch?v=P1CeHGJOX5g
https://www.youtube.com/watch?v=D3lhrrXb4WI
https://www.youtube.com/watch?v=jroF3PH-PTs
https://www.youtube.com/watch?v=hQaN5w3YwtM
https://www.youtube.com/watch?v=VsTMXuIV3OM
https://www.youtube.com/watch?v=GFyijjy1KdU
https://www.youtube.com/watch?v=qxxnRMT9C-8
https://www.youtube.com/watch?v=5sCGZAcXKWg
https://www.youtube.com/watch?v=KVXnVe8eOkM
https://www.youtube.com/watch?v=BFU1OCkhBwo
https://www.youtube.com/watch?v=xDQyLnNAXr4
https://www.youtube.com/watch?v=P7Y-fynYsgE
https://www.youtube.com/watch?v=4QLWlcneJig
https://www.youtube.com/watch?v=ZPVdK9v0CK8
https://www.youtube.com/watch?v=Oipkl53n938
https://www.youtube.com/watch?v=5Tr7AhkOEj4
https://www.youtube.com/watch?v=2ZKLaUbB33o
https://www.youtube.com/watch?v=C7LL7VwP8Nc
https://www.youtube.com/watch?v=FoeQUNASmTU
https://www.youtube.com/watch?v=I_w81rptxkc
https://www.youtube.com/watch?v=yUNoJ32eLBc
https://www.youtube.com/watch?v=nJeU72Rgjh4
https://www.youtube.com/watch?v=w3dTmyZq4Qk
https://www.youtube.com/watch?v=99xyy1nUpug
https://www.youtube.com/watch?v=sR7S2Q3c04g
https://www.youtube.com/watch?v=0t_DD5568RA
https://www.youtube.com/watch?v=pXlMKzcZlwM
https://www.youtube.com/watch?v=Uvy5mcLiWW0
https://www.youtube.com/watch?v=EScgrk7oEwU
https://www.youtube.com/watch?v=ajgwabD4_HE
https://www.youtube.com/watch?v=s52O1JH2tnU
https://www.youtube.com/watch?v=Xm_PHZXGe-w
https://www.youtube.com/watch?v=t38LbMVoPCs
https://www.youtube.com/watch?v=nrwNSSyKuD4
https://www.youtube.com/watch?v=xcXfcXJvMXg
https://www.youtube.com/watch?v=fpETS6q1Hww
https://www.youtube.com/watch?v=9uSXOr-AdAU
  `.trim().split('\n').map(u => u.trim()).filter(u => u.startsWith('http')),

  dryRun: false,
};

// ─────────────────────────────────────────────────────────────────────────────

const EDEN_URL  = 'https://beta.eden.so';

function log(msg, type = 'info') {
  const icons = { info: '→', success: '✓', error: '✗', warn: '⚠' };
  console.log(`[${new Date().toLocaleTimeString()}] ${icons[type] || '·'} ${msg}`);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForEnter(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', () => { process.stdin.pause(); resolve(); });
  });
}

// ── AUTO LOGIN ────────────────────────────────────────────────────────────────

async function autoLogin(edenPage) {
  // Intercept the API call to see what's being sent
  await edenPage.route('**/auth/send-magic-code', async route => {
    const req = route.request();
    log(`API call: ${req.method()} ${req.url()}`);
    log(`Body: ${req.postData()}`);
    await route.continue();
  });

  // Fill email using type() so React onChange fires
  const emailInput = edenPage.locator('input[type="email"], input[placeholder*="email" i]');
  await emailInput.waitFor({ timeout: 10000 });
  await emailInput.click({ clickCount: 3 });
  await sleep(200);
  await emailInput.fill('');
  await sleep(100);
  await emailInput.type(EDEN_EMAIL, { delay: 50 });
  await sleep(500);

  const filled = await emailInput.inputValue().catch(() => '');
  log(`Email field: "${filled}"`);
  log(`Email ready: ${EDEN_EMAIL}`, 'success');

  // Click the submit button once only
  const sendBtn = edenPage.locator('button[type="submit"]');
  await sendBtn.waitFor({ timeout: 5000 });
  // Record exact click time BEFORE clicking
  const requestTime = Date.now();
  await sendBtn.click();
  log(`Clicked: Send the magic code at ${new Date(requestTime).toLocaleTimeString()}`);

  // Wait for page to transition
  await sleep(3000);
  await edenPage.waitForLoadState('networkidle').catch(() => {});

  // Wait for the code entry screen
  log('Waiting for code entry screen...');
  try {
    await edenPage.waitForSelector(
      'input[type="text"], input[type="number"], input[inputmode="numeric"], input[autocomplete="one-time-code"]',
      { timeout: 30000 }
    );
    log('Code entry screen appeared.', 'success');
  } catch {
    log('Code screen not detected — proceeding to Gmail poll anyway...', 'warn');
  }

  log('Waiting 10 seconds for email to arrive...');
  await sleep(10000);

  const code = await getCodeFromGmail(requestTime);
  if (!code) {
    log('Could not find code automatically.', 'warn');
    await waitForEnter('\n  👉  Enter the magic code into Eden manually, then press Enter once logged in...\n\n');
    return;
  }

  await enterCode(edenPage, code);
}

async function enterCode(edenPage, code) {
  log(`Entering code: ${code}`);
  await edenPage.bringToFront();

  // Eden uses a hidden input (opacity-0, pointer-events-none) behind styled divs.
  // We can't click it directly — instead focus it via JS then type with keyboard.
  log('Focusing hidden OTP input via JS...');
  await edenPage.waitForSelector('#code, input[autocomplete="one-time-code"]', { timeout: 20000 });
  await sleep(300);

  // Focus the hidden input directly via JavaScript
  await edenPage.evaluate(() => {
    const input = document.querySelector('#code') || document.querySelector('input[autocomplete="one-time-code"]');
    if (input) input.focus();
  });
  await sleep(300);

  // Type each digit — the hidden input captures keystrokes even though it's invisible
  for (const digit of code) {
    await edenPage.keyboard.press(digit);
    await sleep(150);
  }

  await sleep(1000);
  await edenPage.keyboard.press('Enter');
  await edenPage.waitForLoadState('networkidle').catch(() => {});
  await sleep(2000);
  log('Logged in to Eden!', 'success');
}

async function getCodeFromGmail(requestedAt = Date.now()) {
  // Use Gmail API with saved OAuth token — no browser needed
  if (!fs.existsSync(TOKEN_FILE) || !fs.existsSync(CREDENTIALS_FILE)) {
    log('Gmail token not found — run node eden_setup_gmail.js first, or enter the code manually.', 'warn');
    return null;
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_FILE));
  const { client_id, client_secret } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/callback');
  oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(TOKEN_FILE)));

  // Auto-refresh token if expired
  oAuth2Client.on('tokens', tokens => {
    const existing = JSON.parse(fs.readFileSync(TOKEN_FILE));
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ ...existing, ...tokens }, null, 2));
  });

  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  log('Polling Gmail API for magic code...');

  // Use Unix timestamp in query so Gmail returns fresh results, not cached ones
  const afterTimestamp = Math.floor((requestedAt - 5000) / 1000);
  const seenIds = new Set();

  for (let attempt = 0; attempt < 20; attempt++) {
    process.stdout.write(`\r  Checking Gmail... attempt ${attempt + 1}/20`);
    await sleep(3000);

    try {
      const res = await gmail.users.messages.list({
        userId: 'me',
        q: 'from:eden subject:"login code"',
        maxResults: 5,
      });

      log(`  Gmail returned ${(res.data.messages || []).length} messages`);
      log(`  Raw response: ${JSON.stringify(res.data).substring(0, 200)}`);

      const messages = res.data.messages || [];
      if (messages.length === 0) {
        log('  No messages found — check Gmail query');
        continue;
      }

      // Fetch ALL returned messages and find the absolute newest
      const fetched = await Promise.all(
        messages.map(m => gmail.users.messages.get({ userId: 'me', id: m.id, format: 'full' }))
      );

      // Sort by internalDate — newest first
      fetched.sort((a, b) => parseInt(b.data.internalDate) - parseInt(a.data.internalDate));

      // Log all found emails for debugging
      for (const f of fetched) {
        const t = new Date(parseInt(f.data.internalDate)).toLocaleTimeString();
        log(`  Found email from ${t}`);
      }

      // Take the single newest email only
      const newest = fetched[0];
      const receivedMs = parseInt(newest.data.internalDate);
      const sentTime = new Date(receivedMs).toLocaleTimeString();

      // Recursively extract all text from payload parts
      function extractText(payload) {
        let text = '';
        if (payload.body?.data) {
          text += Buffer.from(payload.body.data, 'base64').toString('utf8');
        }
        if (payload.parts) {
          for (const p of payload.parts) text += extractText(p);
        }
        return text;
      }

      const fullBody = extractText(newest.data.payload);


      // Find all 6-digit numbers in the body
      const allCodes = [...fullBody.matchAll(/\b(\d{6})\b/g)].map(m => m[1]);
      log(`  All 6-digit numbers found: ${allCodes.join(', ')}`);

      // Filter out hex colour codes (preceded by #) and template placeholders
      const excluded = new Set(['666666', '999999', '000000', '111111', '123456']);
      const realCodes = allCodes.filter(c => {
        if (excluded.has(c)) return false;
        // Skip if this number appears as a CSS hex colour (#272523 etc)
        if (fullBody.includes('#' + c)) return false;
        return true;
      });
      log(`  Candidate codes: ${realCodes.join(', ')}`);

      if (realCodes.length > 0) {
        // The real code is the one closest to "code below" in the email
        // Try matching it contextually first
        const contextMatch = fullBody.match(/code below[^\d]*(\d{6})/i) ||
                             fullBody.match(/verification code[^\d]*(\d{6})/i) ||
                             fullBody.match(/paste.*?(\d{6})/i);
        // Real code is always the last candidate — previous session codes appear first in HTML
        const code = contextMatch ? contextMatch[1] : realCodes[realCodes.length - 1];
        console.log('');
        log(`Found magic code: ${code} (sent ${sentTime})`, 'success');
        return code;
      }
    } catch (err) {
      log(`Gmail API error: ${err.message}`, 'warn');
    }
  }
  console.log('');
  log('Could not find code in Gmail after 60 seconds.', 'warn');
  return null;
}

// ── UPLOAD ────────────────────────────────────────────────────────────────────

async function openPasteLinkDialog(page) {
  await page.keyboard.press('Escape');
  await sleep(300);

  const x = await page.evaluate(() => window.innerWidth * 0.55);
  const y = 150;

  log(`  Right-clicking at (${Math.round(x)}, ${y})...`);
  await page.mouse.click(x, y, { button: 'right' });
  await sleep(700);

  const pasteLinkItem = page.locator('text="Paste Link"');
  try {
    await pasteLinkItem.waitFor({ timeout: 4000 });
  } catch {
    await page.keyboard.press('Escape');
    await sleep(300);
    log('  Retrying right-click slightly lower...', 'warn');
    await page.mouse.click(x, 220, { button: 'right' });
    await sleep(700);
    await pasteLinkItem.waitFor({ timeout: 5000 });
  }

  await pasteLinkItem.click();
  await sleep(700);
  await page.locator('dialog[open] input[placeholder="Paste a link..."]').waitFor({ timeout: 5000 });
}

async function saveLink(page, url, index, total) {
  log(`[${index + 1}/${total}] Saving: ${url}`);

  if (CONFIG.dryRun) {
    log(`  DRY RUN — would save: ${url}`, 'warn');
    await sleep(500);
    return true;
  }

  try {
    await openPasteLinkDialog(page);
    const input = page.locator('dialog[open] input[placeholder="Paste a link..."]');
    await input.click();
    await input.fill(url);
    await sleep(400);
    await input.press('Enter');
    await page.locator('dialog[open]').waitFor({ state: 'hidden', timeout: 15000 });
    await sleep(1500);
    log(`  Saved!`, 'success');
    return true;
  } catch (err) {
    if (err.message.includes('closed')) { log('Browser closed.', 'warn'); process.exit(0); }
    log(`  Failed: ${err.message}`, 'error');
    try { await page.keyboard.press('Escape'); } catch {}
    await sleep(1000);
    return false;
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────────

async function main() {
  const { urls } = CONFIG;
  if (urls.length === 0) { log('No URLs in CONFIG.urls', 'error'); process.exit(1); }
  if (CONFIG.dryRun) log('=== DRY RUN — nothing will be saved ===', 'warn');

  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const edenPage = await context.newPage();
  const results = { success: 0, failed: 0, failedUrls: [] };

  browser.on('disconnected', () => {
    console.log('\n─────────────────────────────');
    log(`Browser closed. ${results.success} saved, ${results.failed} failed.`, 'warn');
    if (results.failedUrls.length > 0) results.failedUrls.forEach(u => console.log('  ' + u));
    console.log('─────────────────────────────\n');
    process.exit(0);
  });

  try {
    log('Opening Eden...');
    await edenPage.goto(EDEN_URL, { waitUntil: 'networkidle' });

    // Wait a beat for any redirects/auth checks to settle
    await sleep(3000);
    await edenPage.waitForLoadState('networkidle');

    // Detect login state
    const needsEmail = await edenPage.locator('input[type="email"], input[placeholder*="email" i]').isVisible().catch(() => false);
    const codeBoxes  = await edenPage.locator('input[type="text"], input[type="number"], input[inputmode="numeric"]').count().catch(() => 0);
    const hasCodeText = await edenPage.locator('text="magic code"').isVisible().catch(() => false);
    const needsCode  = codeBoxes >= 4 || hasCodeText;

    log(`State — needsEmail: ${needsEmail}, codeBoxes: ${codeBoxes}, hasCodeText: ${hasCodeText}`);

    if (needsEmail) {
      log('Login required — auto-filling email...');
      await autoLogin(edenPage);
    } else if (needsCode) {
      log(`Code entry screen detected (${codeBoxes} boxes) — fetching from Gmail...`, 'warn');
      const requestTime = Date.now();
      log('Waiting 10 seconds for Eden to send the email...');
      await sleep(10000);
      const code = await getCodeFromGmail(requestTime);
      if (code) {
        await enterCode(edenPage, code);
      } else {
        log('Could not find code automatically — please enter it manually in the browser.', 'warn');
        await waitForEnter('\n  👉  Enter the magic code in the browser, then press Enter here once logged in...\n\n');
      }
    } else {
      log('Already logged in!', 'success');
    }

    await waitForEnter('\n  👉  Navigate to your DOAC project page so white space is visible below the title, then press Enter to start uploading...\n\n');

    log(`Starting upload of ${urls.length} links...`, 'success');

    const MAX_RETRIES = 3;
    for (let i = 0; i < urls.length; i++) {
      let ok = false;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        if (attempt > 1) log(`  Retry ${attempt - 1} of ${MAX_RETRIES - 1} for: ${urls[i]}`, 'warn');
        ok = await saveLink(edenPage, urls[i], i, urls.length);
        if (ok) break;
        await sleep(2000);
      }
      if (ok) results.success++;
      else { results.failed++; results.failedUrls.push(urls[i]); log(`  Giving up on: ${urls[i]}`, 'error'); }
    }

  } catch (err) {
    if (!err.message.includes('closed')) {
      log(`Unexpected error: ${err.message}`, 'error');
      try { await edenPage.screenshot({ path: 'eden_error.png' }); log('Screenshot saved to eden_error.png'); } catch {}
    }
  } finally {
    try { await browser.close(); } catch {}
  }

  console.log('\n─────────────────────────────');
  log(`Done! ${results.success} saved, ${results.failed} failed.`, results.failed === 0 ? 'success' : 'warn');
  if (results.failedUrls.length > 0) {
    log('Failed URLs:', 'error');
    results.failedUrls.forEach(u => console.log('  ' + u));
  }
  console.log('─────────────────────────────\n');
}

main();
