import * as pulumi from "@pulumi/pulumi";

const defaultBaseUrl: string = "https://api.dynadot.com/api3.xml";

interface DynadotDomainSetNameserverInputs {
  domain: string;
  nameservers: string[];
  token: string;
}

type DynadotDomainSetNameserverOutputs = DynadotDomainSetNameserverInputs;

interface DynadotDomainSetNameserverResponse {
  SetNsResponse: {
    SetNsHeader: [
      {
        SuccessCode: string[];
        Status: string[];
      }
    ];
  };
}

interface DynadotDomainGetNameserverResponse {
  GetNsResponse: {
    GetNsHeader: [
      {
        SuccessCode: string[];
        Status: string[];
      }
    ];
    NsContent: [
      {
        Host: string[];
      }
    ];
  };
}

class DynadotDomainSetNameserverProvider
  implements pulumi.dynamic.ResourceProvider
{
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  async create(
    props: DynadotDomainSetNameserverInputs
  ): Promise<pulumi.dynamic.CreateResult> {
    const got = (await import("got")).default;
    const xml2js = await import("xml2js");

    let fullUrl = defaultBaseUrl;
    fullUrl += "?key=" + props.token;
    fullUrl += "&command=set_ns";
    fullUrl += "&domain=" + props.domain;

    props.nameservers.forEach(
      (ns, index) => (fullUrl += `&ns${index}=${ns.replace(/\.$/, "")}`)
    );

    let data = await got.get(fullUrl).text();

    const parser = new xml2js.Parser({ attrkey: "ATTR" });
    const response: DynadotDomainSetNameserverResponse =
      await parser.parseStringPromise(data);

    if (response.SetNsResponse.SetNsHeader[0].SuccessCode[0] != "0") {
      throw new Error("Failed to set namespaces");
    }

    const outs: DynadotDomainSetNameserverOutputs = {
      domain: props.domain,
      nameservers: props.nameservers,
      token: props.token,
    };

    return { id: props.domain!, outs };
  }

  async read(
    _: string,
    props: DynadotDomainSetNameserverOutputs
  ): Promise<pulumi.dynamic.ReadResult> {
    const got = (await import("got")).default;
    const xml2js = await import("xml2js");

    let fullUrl = defaultBaseUrl;
    fullUrl += "?key=" + props.token;
    fullUrl += "&command=get_ns";
    fullUrl += "&domain=" + props.domain;

    let data = await got.get(fullUrl).text();

    const parser = new xml2js.Parser({ attrkey: "ATTR" });
    const response: DynadotDomainGetNameserverResponse =
      await parser.parseStringPromise(data);

    if (response.GetNsResponse.GetNsHeader[0].SuccessCode[0] != "0") {
      throw new Error("Failed to get namespaces");
    }

    const outs: DynadotDomainSetNameserverOutputs = {
      domain: props.domain,
      nameservers: response.GetNsResponse.NsContent[0].Host,
      token: props.token,
    };

    return { id: props.domain!, props: outs };
  }

  async update(
    _: string,
    olds: DynadotDomainSetNameserverOutputs,
    news: DynadotDomainSetNameserverOutputs
  ): Promise<pulumi.dynamic.UpdateResult> {
    return { outs: { ...olds, ...news } };
  }
}

export class DynaDotDomainNameservers extends pulumi.dynamic.Resource {
  public readonly nameservers: pulumi.Output<string[]>;

  constructor(
    name: string,
    props: DynadotDomainSetNameserverInputs,
    opts?: pulumi.CustomResourceOptions
  ) {
    super(new DynadotDomainSetNameserverProvider(name), name, props, opts);
  }
}
