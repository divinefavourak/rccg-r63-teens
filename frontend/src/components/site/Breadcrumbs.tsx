import { Link } from 'react-router-dom';

export type Crumb = { name: string; path: string };

/**
 * The visible half of the BreadcrumbList that <Seo trail> writes into <head>.
 * Pass the same array to both so the two cannot disagree. The last crumb is the
 * page itself and is not a link.
 */
const Breadcrumbs = ({ trail }: { trail: Crumb[] }) => (
  <nav aria-label="Breadcrumb">
    <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-label-md">
      {trail.map((crumb, i) => {
        const last = i === trail.length - 1;
        return (
          <li key={crumb.path} className="flex min-w-0 items-center gap-2">
            {last ? (
              <span aria-current="page" className="max-w-[220px] truncate opacity-75 lg:max-w-[360px]">
                {crumb.name}
              </span>
            ) : (
              <>
                <Link
                  to={crumb.path}
                  className="rounded underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                >
                  {crumb.name}
                </Link>
                <span aria-hidden className="opacity-50">
                  /
                </span>
              </>
            )}
          </li>
        );
      })}
    </ol>
  </nav>
);

export default Breadcrumbs;
