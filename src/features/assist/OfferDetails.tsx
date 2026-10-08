import type {Offer,OfferMatch} from '../../contracts';
import {offerPresentation} from '../../domain/offer-presentation';
import s from '../workspace/Workspace.module.css';

export function OfferDetails({offer,match}:{offer:Offer|null;match?:OfferMatch}){
 if(!offer)return <p>Choose a company to see its documented terms and what needs confirmation.</p>;
 const view=offerPresentation(offer);
 return <div className={s.offerDetails} tabIndex={0} aria-label={`${offer.companyName} offer details`}><h3>{offer.companyName}</h3><p>{view.programLabel} · {view.status}</p><dl>{view.rows.map(row=><div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>{!!match?.conflicts.length&&<section><h4>Does not meet this driver’s answers</h4><ul>{match.conflicts.map(value=><li key={value}>{value}</li>)}</ul></section>}<section><h4>Confirm before recommending</h4><ul>{[...new Set([...view.verification,...match?.missingFacts??[]])].map(value=><li key={value}>{value}</li>)}</ul></section>{!!match?.reasons.length&&<section><h4>Driver comparison</h4><ul>{match.reasons.map(value=><li key={value}>{value}</li>)}</ul></section>}<details><summary>Catalog source</summary><p>{view.source}</p><p>Snapshot: {offer.snapshotVersion}. {offer.verifiedAt?`Verified: ${offer.verifiedAt}.`:'Current terms have not been verified.'}</p></details></div>;
}
