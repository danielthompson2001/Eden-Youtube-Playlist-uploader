/**
 * Eden.so Upload Verifier
 *
 * Fetches video titles from YouTube API, scans your Eden DOAC project
 * for those titles, and outputs any that are missing.
 *
 * USAGE:
 *   node eden_verify.js
 *
 *   1. Browser opens Eden
 *   2. Log in with your magic code
 *   3. Navigate to your DOAC project page
 *   4. Press Enter — script scans and cross-references
 *   5. Missing URLs saved to missing_urls.txt
 */

const { chromium } = require('playwright');
const fs = require('fs');
const https = require('https');

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const YOUTUBE_API_KEY = 'YOUR_API_KEY_HERE';

const EXPECTED_URLS = `
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
`.trim().split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));

// ─────────────────────────────────────────────────────────────────────────────

const EDEN_URL = 'https://beta.eden.so';

function log(msg, type = 'info') {
  const icons = { info: '→', success: '✓', error: '✗', warn: '⚠' };
  console.log(`[${new Date().toLocaleTimeString()}] ${icons[type] || '·'} ${msg}`);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function waitForEnter(prompt) {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', () => { process.stdin.pause(); resolve(); });
  });
}

function extractVideoId(url) {
  const m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

// Fetch titles from YouTube API in batches of 50
function fetchYouTubeTitles(videoIds) {
  return new Promise((resolve, reject) => {
    const idMap = new Map(); // id -> url
    const titleMap = new Map(); // normalised title -> url

    // Batch into groups of 50 (API limit)
    const batches = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      batches.push(videoIds.slice(i, i + 50));
    }

    let completed = 0;
    let failed = false;

    batches.forEach((batch, batchIndex) => {
      const ids = batch.map(b => b.id).join(',');
      const path = `/youtube/v3/videos?part=snippet&id=${ids}&key=${YOUTUBE_API_KEY}`;

      const req = https.get({
        hostname: 'www.googleapis.com',
        path,
        headers: { 'Accept': 'application/json' }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.error) { reject(new Error(json.error.message)); failed = true; return; }
            for (const item of json.items || []) {
              const title = item.snippet.title.toLowerCase().trim();
              const url = batch.find(b => b.id === item.id)?.url;
              if (url) titleMap.set(title, url);
            }
            completed++;
            log(`  Fetched batch ${completed}/${batches.length} from YouTube API`);
            if (completed === batches.length && !failed) resolve(titleMap);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
    });
  });
}

// Scroll Eden to load all cards, then scrape all visible text
async function scrapeEdenTitles(page) {
  log('Scrolling Eden to load all saved items...');

  let prev = 0;
  let stable = 0;
  while (stable < 3) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await sleep(1500);
    const curr = await page.evaluate(() => document.body.scrollHeight);
    if (curr === prev) stable++; else stable = 0;
    prev = curr;
    process.stdout.write(`\r  Height: ${curr}px, stable: ${stable}/3...`);
  }
  console.log('');
  log('Done scrolling — scraping titles...');

  // Grab all visible text content from cards/items on the page
  const titles = await page.evaluate(() => {
    const texts = new Set();
    // Target common card/item title elements
    const selectors = [
      'h1', 'h2', 'h3', 'h4',
      '[class*="title"]',
      '[class*="name"]',
      '[class*="label"]',
      '[class*="card"] p',
      '[class*="item"] span',
      '[class*="file"] span',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 3 && t.length < 300) texts.add(t.toLowerCase());
      });
    }
    return Array.from(texts);
  });

  return new Set(titles);
}

// Fuzzy match — check if any Eden title contains enough of the YouTube title
function isTitleFound(youtubeTitle, edenTitles) {
  const yt = youtubeTitle.toLowerCase();

  // Exact match
  if (edenTitles.has(yt)) return true;

  // Check if any Eden title contains the YouTube title or vice versa
  for (const edenTitle of edenTitles) {
    if (edenTitle.includes(yt)) return true;
    if (yt.includes(edenTitle) && edenTitle.length > 10) return true;

    // Word overlap — if 70%+ of words match, consider it found
    const ytWords = yt.split(/\s+/).filter(w => w.length > 3);
    const edenWords = new Set(edenTitle.split(/\s+/));
    if (ytWords.length > 0) {
      const matches = ytWords.filter(w => edenWords.has(w)).length;
      if (matches / ytWords.length >= 0.7) return true;
    }
  }
  return false;
}

async function main() {
  if (YOUTUBE_API_KEY === 'YOUR_API_KEY_HERE') {
    log('Please set your YOUTUBE_API_KEY at the top of the script.', 'error');
    process.exit(1);
  }

  // Build video ID list
  const videoIds = EXPECTED_URLS.map(url => ({ id: extractVideoId(url), url })).filter(v => v.id);
  log(`Looking up ${videoIds.length} video titles from YouTube API...`);

  let titleMap;
  try {
    titleMap = await fetchYouTubeTitles(videoIds);
    log(`Retrieved ${titleMap.size} titles from YouTube.`, 'success');
  } catch (err) {
    log(`YouTube API error: ${err.message}`, 'error');
    process.exit(1);
  }

  // Open Eden
  const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();

  try {
    log('Opening Eden...');
    await page.goto(EDEN_URL, { waitUntil: 'networkidle' });

    await waitForEnter('\n  👉  Log in to Eden, navigate to your DOAC project page, then press Enter to start scanning...\n\n');

    const cur = page.url();
    if (cur.includes('login') || cur.includes('auth') || cur.includes('magic')) {
      log('Not logged in yet.', 'error'); await browser.close(); process.exit(1);
    }

    const edenTitles = await scrapeEdenTitles(page);
    log(`Found ${edenTitles.size} text items in Eden.`);

    // Cross-reference
    const missing = [];
    const found = [];

    for (const [ytTitle, url] of titleMap) {
      if (isTitleFound(ytTitle, edenTitles)) {
        found.push({ title: ytTitle, url });
      } else {
        missing.push({ title: ytTitle, url });
      }
    }

    // Results
    console.log('\n─────────────────────────────');
    log(`Total expected: ${titleMap.size}`);
    log(`Found in Eden:  ${found.length}`, 'success');
    log(`Missing:        ${missing.length}`, missing.length > 0 ? 'error' : 'success');
    console.log('─────────────────────────────\n');

    if (missing.length > 0) {
      console.log('Missing videos:');
      missing.forEach(({ title, url }) => console.log(`  ✗ ${title}\n    ${url}`));

      // Save missing URLs ready to re-paste into eden_upload.js
      fs.writeFileSync('missing_urls.txt', missing.map(m => m.url).join('\n'));
      log(`\nSaved ${missing.length} missing URLs to missing_urls.txt`, 'success');
      log('Paste the contents of missing_urls.txt into CONFIG.urls in eden_upload.js to re-upload.', 'info');
    } else {
      log('All videos are saved in Eden — nothing missing!', 'success');
    }

  } catch (err) {
    log(`Error: ${err.message}`, 'error');
    try { await page.screenshot({ path: 'verify_error.png' }); log('Screenshot saved to verify_error.png'); } catch {}
  } finally {
    try { await browser.close(); } catch {}
  }
}

main();
